import type { IncomingMessage } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { Actor } from "../../../shared/application/context/ActorContext.ts";
import type { SessionResolverPort } from "../../../shared/application/ports/SessionResolverPort.ts";
import {
  authenticatedRoute,
  type RouteResult,
} from "../../../shared/infrastructure/http/authenticatedRoute.ts";
import type { SemanticSearchUseCase } from "../application/usecase/SemanticSearchUseCase.ts";
import type { RebuildIndexUseCase } from "../application/usecase/IndexingUseCases.ts";
import { SemanticSearchCommand, RebuildIndexCommand } from "../application/command/RetrievalCommands.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;

export interface RetrievalModuleDeps {
  readonly applicationService: ApplicationService;
  // Resolves the session cookie to the authenticated Actor at the shared edge
  // (`authenticatedRoute`); Retrieval no longer re-implements session lookup (ADR-011 amendment).
  readonly sessionResolver: SessionResolverPort;
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
    httpServer.rawPost(
      "/search",
      authenticatedRoute(this.deps.sessionResolver, (request, _params, actor) =>
        this.handleSearch(request, actor),
      ),
    );
    httpServer.rawPost(
      "/index/rebuild",
      authenticatedRoute(this.deps.sessionResolver, (_request, _params, actor) =>
        this.handleRebuild(actor),
      ),
    );
  }

  private async handleSearch(request: IncomingMessage, actor: Actor): Promise<RouteResult> {
    if (actor.companyId === null) {
      return {
        statusCode: HTTP_FORBIDDEN,
        body: { error: "retrieval.tenantScopeRequired", message: "A tenant-scoped session is required" },
      };
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
      return {
        statusCode: HTTP_FORBIDDEN,
        body: { error: "retrieval.tenantScopeRequired", message: "A tenant-scoped session is required" },
      };
    }
    if (actor.roles === undefined || !actor.roles.includes("admin")) {
      return {
        statusCode: HTTP_FORBIDDEN,
        body: { error: "retrieval.adminRoleRequired", message: "Forbidden: admin role required" },
      };
    }
    const reprojected = await this.deps.applicationService.execute(
      this.deps.rebuildIndex,
      RebuildIndexCommand.of(actor.companyId),
    );
    return { statusCode: HTTP_OK, body: { reprojected } };
  }

  private static requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new DomainError("common.fieldRequired", "validation", { field }, "Field '" + field + "' is required");
    }
    return value;
  }

  private static optionalString(body: Record<string, unknown>, field: string): string | null {
    const value = body[field];
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new DomainError(
        "common.fieldInvalid",
        "validation",
        { field },
        "Field '" + field + "' must be a non-empty string when present",
      );
    }
    return value;
  }
}
