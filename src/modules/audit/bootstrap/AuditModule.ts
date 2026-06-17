import type { IncomingMessage } from "node:http";
import type { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { SessionResolverPort } from "../../../shared/application/ports/SessionResolverPort.ts";
import {
  authenticatedRoute,
  type RouteResult,
} from "../../../shared/infrastructure/http/authenticatedRoute.ts";
import type { ListAuditTrailUseCase } from "../application/usecase/ListAuditTrailUseCase.ts";
import { ListAuditTrailQuery } from "../application/query/ListAuditTrailQuery.ts";

const HTTP_OK = 200;

export interface AuditModuleDeps {
  readonly applicationService: ApplicationService;
  readonly sessionResolver: SessionResolverPort;
  readonly listAuditTrail: ListAuditTrailUseCase;
}

/**
 * Audit trail REST edge (PRD-6, Auditor persona). A read-only, session-authenticated window
 * onto the tenant's domain-event stream. Authorization (auditor/admin) and tenant scoping are
 * enforced inside the use case + repository — the shared `authenticatedRoute` resolves the human
 * session into an actor context, and the edge only maps query parameters to the audit query.
 */
export class AuditModule {
  private readonly deps: AuditModuleDeps;

  constructor(deps: AuditModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawGet(
      "/audit/events",
      authenticatedRoute(this.deps.sessionResolver, (request) => this.handleListEvents(request)),
    );
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
}
