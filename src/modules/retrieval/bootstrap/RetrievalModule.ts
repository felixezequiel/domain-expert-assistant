import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import { readSessionToken } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";
import type { SemanticSearchUseCase } from "../application/usecase/SemanticSearchUseCase.ts";
import type { RebuildIndexUseCase } from "../application/usecase/IndexingUseCases.ts";
import { SemanticSearchCommand, RebuildIndexCommand } from "../application/command/RetrievalCommands.ts";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;

interface RouteResult {
  readonly statusCode: number;
  readonly body: unknown;
}

export interface RetrievalModuleDeps {
  readonly applicationService: ApplicationService;
  readonly resolveSession: ResolveSessionUseCase;
  readonly semanticSearch: SemanticSearchUseCase;
  readonly rebuildIndex: RebuildIndexUseCase;
}

/**
 * Retrieval REST edge. `POST /search` is authenticated and tenant-scoped: the scope
 * (collections + sensitivity ceiling) arrives pre-resolved in the body — the credential-scope
 * intersection is PRD-5's job; here the company floor comes from the resolved principal, never
 * the body (ADR-022, fail-closed). `POST /index/rebuild` is admin-only and reprojects the
 * tenant's served items from scratch (the index is derived, ADR-020).
 */
export class RetrievalModule {
  private readonly deps: RetrievalModuleDeps;

  constructor(deps: RetrievalModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawPost("/search", (request, response) => {
      void this.authed(request, response, (actor) => this.handleSearch(request, actor));
    });
    httpServer.rawPost("/index/rebuild", (request, response) => {
      void this.authed(request, response, (actor) => this.handleRebuild(actor));
    });
  }

  private async authed(
    request: IncomingMessage,
    response: ServerResponse,
    run: (actor: Actor) => Promise<RouteResult>,
  ): Promise<void> {
    const token = readSessionToken(request.headers.cookie);
    const principal = token === null ? null : await this.deps.resolveSession.execute(token);
    if (principal === null) {
      this.respond(response, { statusCode: HTTP_UNAUTHORIZED, body: { error: "Unauthorized" } });
      return;
    }
    const actor: Actor = {
      companyId: principal.companyId,
      actorId: principal.actorId,
      actorType: principal.actorType,
      roles: principal.roles,
    };
    try {
      this.respond(response, await runWithActor(actor, () => run(actor)));
    } catch (error) {
      this.respondError(response, error);
    }
  }

  private async handleSearch(request: IncomingMessage, actor: Actor): Promise<RouteResult> {
    if (actor.companyId === null) {
      return { statusCode: HTTP_FORBIDDEN, body: { error: "A tenant-scoped session is required" } };
    }
    const body = await HttpServer.readJsonBody(request);
    const query = RetrievalModule.requireString(body, "query");
    const collectionId = RetrievalModule.optionalString(body, "collectionId");
    const sensitivityCeiling = RetrievalModule.optionalString(body, "sensitivityCeiling");
    let collectionIds: ReadonlyArray<string> | null = null;
    if (collectionId !== null) {
      collectionIds = [collectionId];
    }
    const command = SemanticSearchCommand.of(actor.companyId, query, collectionIds, sensitivityCeiling);
    const results = await this.deps.applicationService.execute(this.deps.semanticSearch, command);
    return { statusCode: HTTP_OK, body: { results } };
  }

  private async handleRebuild(actor: Actor): Promise<RouteResult> {
    if (actor.companyId === null) {
      return { statusCode: HTTP_FORBIDDEN, body: { error: "A tenant-scoped session is required" } };
    }
    if (actor.roles === undefined || !actor.roles.includes("admin")) {
      return { statusCode: HTTP_FORBIDDEN, body: { error: "Forbidden: admin role required" } };
    }
    const reprojected = await this.deps.applicationService.execute(
      this.deps.rebuildIndex,
      RebuildIndexCommand.of(actor.companyId),
    );
    return { statusCode: HTTP_OK, body: { reprojected } };
  }

  private respond(response: ServerResponse, result: RouteResult): void {
    response.writeHead(result.statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result.body));
  }

  private respondError(response: ServerResponse, error: unknown): void {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const isClientError = message.includes("required") || message.startsWith("Forbidden");
    const statusCode = isClientError ? HTTP_BAD_REQUEST : HTTP_INTERNAL_ERROR;
    this.respond(response, { statusCode, body: { error: message } });
  }

  private static requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Field '" + field + "' is required");
    }
    return value;
  }

  private static optionalString(body: Record<string, unknown>, field: string): string | null {
    const value = body[field];
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Field '" + field + "' must be a non-empty string when present");
    }
    return value;
  }
}
