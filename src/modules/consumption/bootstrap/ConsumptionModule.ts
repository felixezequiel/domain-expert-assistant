import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import type { AuthenticateConsumerUseCase } from "../../identity/application/usecase/AuthenticateConsumerUseCase.ts";
import type { ConsumerCredential } from "../../identity/domain/aggregates/ConsumerCredential.ts";
import type { KnowledgeQueryFacade } from "../application/service/KnowledgeQueryFacade.ts";
import type { RecordCredentialUsageUseCase } from "../application/usecase/RecordCredentialUsageUseCase.ts";
import type { FixedWindowRateLimiter } from "../infrastructure/http/RateLimiter.ts";
import { ConsumptionMcpTools } from "../infrastructure/mcp/ConsumptionMcpTools.ts";
import { buildConsumptionMcpServer } from "../infrastructure/mcp/buildConsumptionMcpServer.ts";
import {
  respondResult,
  respondError,
  type RouteResult,
} from "../../../shared/infrastructure/http/authenticatedRoute.ts";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;

const BEARER_PREFIX = "Bearer ";

export interface ConsumptionModuleDeps {
  readonly applicationService: ApplicationService;
  readonly authenticateConsumer: AuthenticateConsumerUseCase;
  readonly knowledgeQueryFacade: KnowledgeQueryFacade;
  readonly recordCredentialUsage: RecordCredentialUsageUseCase;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly logger: LoggerPort;
}

/**
 * Consumption Gateway edge (PRD-5): the consumer-facing REST API and the MCP server over
 * HTTP. Authentication is `Authorization: Bearer <api-key>` (ADR-021), resolved to an active
 * `ConsumerCredential` (→ 401 if unknown/revoked). On success it opens the consumer Actor
 * Context (`actorType='consumer'`), enforces a per-credential in-memory rate limit (→ 429),
 * records `lastUsedAt` through a use case staged on the unit of work (no direct flush), and
 * delegates every read to the single `KnowledgeQueryFacade` so REST and MCP share one scope
 * enforcement and return identical data (ADR-021/022). A `ScopeViolationError` → 403.
 */
export class ConsumptionModule {
  private readonly deps: ConsumptionModuleDeps;
  private readonly mcpTools: ConsumptionMcpTools;

  constructor(deps: ConsumptionModuleDeps) {
    this.deps = deps;
    this.mcpTools = new ConsumptionMcpTools(deps.knowledgeQueryFacade);
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawGet("/v1/search", (request, response) => {
      void this.authed(request, response, (credential) => this.handleSearch(request, credential));
    });
    httpServer.rawGet("/v1/lookup", (request, response) => {
      void this.authed(request, response, (credential) => this.handleLookup(request, credential));
    });
    httpServer.rawGet("/v1/collections", (request, response) => {
      void this.authed(request, response, (credential) => this.handleListCollections(credential));
    });
    httpServer.rawGet("/v1/tags", (request, response) => {
      void this.authed(request, response, (credential) => this.handleListTags(credential));
    });
    httpServer.rawGet("/v1/items/:itemId", (request, response, params) => {
      void this.authed(request, response, (credential) => this.handleGetItem(credential, params.itemId!));
    });

    httpServer.rawPost("/mcp", (request, response) => {
      void this.handleMcp(request, response);
    });
    httpServer.rawGet("/mcp", (request, response) => {
      void this.handleMcp(request, response);
    });
    httpServer.rawDelete("/mcp", (request, response) => {
      void this.handleMcp(request, response);
    });
  }

  // --- auth (Bearer) ---

  private async authenticate(request: IncomingMessage): Promise<ConsumerCredential | null> {
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
      return null;
    }
    const presentedKey = header.slice(BEARER_PREFIX.length).trim();
    if (presentedKey.length === 0) {
      return null;
    }
    return this.deps.authenticateConsumer.execute(presentedKey);
  }

  private consumerActor(credential: ConsumerCredential): Actor {
    return {
      companyId: credential.companyId,
      actorId: credential.id.value,
      actorType: "consumer",
      roles: [],
    };
  }

  private async authed(
    request: IncomingMessage,
    response: ServerResponse,
    run: (credential: ConsumerCredential) => Promise<RouteResult>,
  ): Promise<void> {
    const credential = await this.authenticate(request);
    if (credential === null) {
      respondResult(response, {
        statusCode: HTTP_UNAUTHORIZED,
        body: { error: "common.unauthorized", message: "Invalid or revoked API key" },
      });
      return;
    }
    const limit = this.deps.rateLimiter.check(credential.id.value);
    if (!limit.allowed) {
      respondResult(response, {
        statusCode: HTTP_TOO_MANY_REQUESTS,
        body: {
          error: "consumption.rateLimitExceeded",
          message: "Rate limit exceeded",
          params: { retryAfterSeconds: limit.retryAfterSeconds },
        },
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
      return;
    }
    try {
      const result = await runWithActor(this.consumerActor(credential), async () => {
        await this.recordUsage(credential);
        return run(credential);
      });
      respondResult(response, result);
    } catch (error) {
      respondError(response, error);
    }
  }

  private async recordUsage(credential: ConsumerCredential): Promise<void> {
    try {
      await this.deps.applicationService.execute(this.deps.recordCredentialUsage, {
        credentialId: credential.id.value,
        at: new Date(),
      });
    } catch (error) {
      // Best-effort audit stamp: never fail a valid read because lastUsedAt could not persist.
      this.deps.logger.warn("Failed to record credential usage", {
        credentialId: credential.id.value,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- REST handlers ---

  private async handleSearch(request: IncomingMessage, credential: ConsumerCredential): Promise<RouteResult> {
    const url = new URL(request.url ?? "/v1/search", "http://localhost");
    // `q` is the documented param (PRD-5 §7); accept `query` as an alias so a caller using the
    // longer name isn't silently handed an empty result set (finding P4).
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    const collectionIds = ConsumptionModule.repeatedParam(url, "collection");
    const tags = ConsumptionModule.repeatedParam(url, "tag");
    const k = ConsumptionModule.optionalPositiveInt(url.searchParams.get("k"));
    const response = await this.deps.knowledgeQueryFacade.search(credential.companyId, credential.scope, {
      query,
      collectionIds: collectionIds ?? undefined,
      tags: tags ?? undefined,
      k,
    });
    return { statusCode: HTTP_OK, body: response };
  }

  private async handleLookup(request: IncomingMessage, credential: ConsumerCredential): Promise<RouteResult> {
    const url = new URL(request.url ?? "/v1/lookup", "http://localhost");
    const items = await this.deps.knowledgeQueryFacade.lookup(credential.scope, {
      title: url.searchParams.get("title") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      collectionId: url.searchParams.get("collection") ?? undefined,
    });
    return { statusCode: HTTP_OK, body: { items } };
  }

  private async handleListCollections(credential: ConsumerCredential): Promise<RouteResult> {
    const collections = await this.deps.knowledgeQueryFacade.listCollections(credential.scope);
    return { statusCode: HTTP_OK, body: { collections } };
  }

  private async handleListTags(credential: ConsumerCredential): Promise<RouteResult> {
    const tags = await this.deps.knowledgeQueryFacade.listTags(credential.scope);
    return { statusCode: HTTP_OK, body: { tags } };
  }

  private async handleGetItem(credential: ConsumerCredential, itemId: string): Promise<RouteResult> {
    const item = await this.deps.knowledgeQueryFacade.getItem(credential.scope, itemId);
    if (item === null) {
      return {
        statusCode: HTTP_NOT_FOUND,
        body: { error: "consumption.itemNotFound", message: "Item not found" },
      };
    }
    return { statusCode: HTTP_OK, body: item };
  }

  // --- MCP over Streamable HTTP ---

  private async handleMcp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const credential = await this.authenticate(request);
    if (credential === null) {
      // v1 returns a clean 401 (ADR-021); RFC 9728 discovery hook is a Phase-2 TODO, no impl.
      response.writeHead(HTTP_UNAUTHORIZED, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "common.unauthorized", message: "Invalid or revoked API key" }));
      return;
    }
    const limit = this.deps.rateLimiter.check(credential.id.value);
    if (!limit.allowed) {
      response.writeHead(HTTP_TOO_MANY_REQUESTS, {
        "Content-Type": "application/json",
        "Retry-After": String(limit.retryAfterSeconds),
      });
      response.end(
        JSON.stringify({
          error: "consumption.rateLimitExceeded",
          message: "Rate limit exceeded",
          params: { retryAfterSeconds: limit.retryAfterSeconds },
        }),
      );
      return;
    }

    let body: unknown;
    if (request.method === "POST") {
      try {
        body = await HttpServer.readJsonBody(request);
      } catch {
        response.writeHead(HTTP_BAD_REQUEST, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            error: "common.fieldInvalid",
            message: "Invalid JSON body",
            params: { field: "body" },
          }),
        );
        return;
      }
    }

    await runWithActor(this.consumerActor(credential), async () => {
      await this.recordUsage(credential);
      // Stateless transport: a fresh server+transport per request, bound to this credential.
      // Omitting `sessionIdGenerator` (rather than setting it to undefined, which the project's
      // exactOptionalPropertyTypes forbids) selects the SDK's stateless mode.
      const transport = new StreamableHTTPServerTransport({});
      const server = buildConsumptionMcpServer(this.mcpTools, {
        companyId: credential.companyId,
        credentialScope: credential.scope,
      });
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
      // The SDK is not authored for exactOptionalPropertyTypes, so its Transport interface and
      // the concrete transport differ structurally on optional members; the cast bridges that.
      await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
      await transport.handleRequest(request, response, body);
    });
  }

  // --- helpers ---

  private static repeatedParam(url: URL, name: string): ReadonlyArray<string> | null {
    const values = url.searchParams.getAll(name).filter((value) => value.length > 0);
    return values.length === 0 ? null : values;
  }

  private static optionalPositiveInt(raw: string | null): number | undefined {
    if (raw === null) {
      return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return undefined;
    }
    return parsed;
  }
}
