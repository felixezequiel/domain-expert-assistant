import type { IncomingMessage, ServerResponse } from "node:http";
import type { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import { readSessionToken } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";
import type { ListAuditTrailUseCase } from "../application/usecase/ListAuditTrailUseCase.ts";
import { ListAuditTrailQuery } from "../application/query/ListAuditTrailQuery.ts";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;

interface RouteResult {
  readonly statusCode: number;
  readonly body: unknown;
}

export interface AuditModuleDeps {
  readonly applicationService: ApplicationService;
  readonly resolveSession: ResolveSessionUseCase;
  readonly listAuditTrail: ListAuditTrailUseCase;
}

/**
 * Audit trail REST edge (PRD-6, Auditor persona). A read-only, session-authenticated window
 * onto the tenant's domain-event stream. Authorization (auditor/admin) and tenant scoping are
 * enforced inside the use case + repository — the edge only resolves the human session into an
 * actor context and maps query parameters to the audit query.
 */
export class AuditModule {
  private readonly deps: AuditModuleDeps;

  constructor(deps: AuditModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawGet("/audit/events", (request, response) => {
      void this.authed(request, response, () => this.handleListEvents(request));
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

  private async handleListEvents(request: IncomingMessage): Promise<RouteResult> {
    const url = new URL(request.url ?? "/audit/events", "http://localhost");
    // Build the options object by omitting absent params (exactOptionalPropertyTypes forbids
    // assigning explicit `undefined` to the optional fields of ListAuditTrailOptions).
    const options: {
      aggregateId?: string;
      actorId?: string;
      eventName?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {};
    const aggregateId = AuditModule.nonEmpty(url.searchParams.get("aggregateId"));
    if (aggregateId !== undefined) {
      options.aggregateId = aggregateId;
    }
    const actorId = AuditModule.nonEmpty(url.searchParams.get("actorId"));
    if (actorId !== undefined) {
      options.actorId = actorId;
    }
    const eventName = AuditModule.nonEmpty(url.searchParams.get("eventName"));
    if (eventName !== undefined) {
      options.eventName = eventName;
    }
    const from = AuditModule.nonEmpty(url.searchParams.get("from"));
    if (from !== undefined) {
      options.from = from;
    }
    const to = AuditModule.nonEmpty(url.searchParams.get("to"));
    if (to !== undefined) {
      options.to = to;
    }
    const limit = url.searchParams.get("limit");
    if (limit !== null) {
      options.limit = Number.parseInt(limit, 10);
    }
    const query = ListAuditTrailQuery.of(options);
    const events = await this.deps.applicationService.execute(this.deps.listAuditTrail, query);
    return { statusCode: HTTP_OK, body: { events } };
  }

  private static nonEmpty(value: string | null): string | undefined {
    return value !== null && value.length > 0 ? value : undefined;
  }

  private respond(response: ServerResponse, result: RouteResult): void {
    response.writeHead(result.statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result.body));
  }

  private respondError(response: ServerResponse, error: unknown): void {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    let statusCode = HTTP_INTERNAL_ERROR;
    if (message.startsWith("Forbidden")) {
      statusCode = HTTP_FORBIDDEN;
    } else if (message.includes("Invalid") || message.includes("required")) {
      statusCode = HTTP_BAD_REQUEST;
    }
    this.respond(response, { statusCode, body: { error: message } });
  }
}
