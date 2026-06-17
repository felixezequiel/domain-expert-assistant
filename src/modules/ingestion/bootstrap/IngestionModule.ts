import type { IncomingMessage } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { SessionResolverPort } from "../../../shared/application/ports/SessionResolverPort.ts";
import {
  authenticatedRoute,
  type RouteResult,
} from "../../../shared/infrastructure/http/authenticatedRoute.ts";
import type { UploadDocumentUseCase } from "../application/usecase/UploadDocumentUseCase.ts";
import type { GetIngestionJobUseCase } from "../application/usecase/GetIngestionJobUseCase.ts";
import { UploadDocumentCommand } from "../application/command/IngestionCommands.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

const HTTP_OK = 200;
const HTTP_ACCEPTED = 202;
const HTTP_NOT_FOUND = 404;

export interface IngestionModuleDeps {
  readonly applicationService: ApplicationService;
  // Resolves the session cookie to the authenticated Actor at the shared edge
  // (`authenticatedRoute`); Ingestion no longer re-implements session lookup (ADR-011 amendment).
  readonly sessionResolver: SessionResolverPort;
  readonly uploadDocument: UploadDocumentUseCase;
  readonly getIngestionJob: GetIngestionJobUseCase;
}

/**
 * Ingestion REST edge. Upload accepts the document as base64 in a JSON body (no multipart
 * in v1) and returns 202 immediately with the job id; the worker processes it async. Every
 * route is wrapped by the shared `authenticatedRoute`, which resolves the principal, opens the
 * Actor Context, emits the null-principal 401, and serializes the `RouteResult` / coded error.
 */
export class IngestionModule {
  private readonly deps: IngestionModuleDeps;

  constructor(deps: IngestionModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawPost(
      "/ingestion/uploads",
      authenticatedRoute(this.deps.sessionResolver, (request) => this.handleUpload(request)),
    );
    httpServer.rawGet(
      "/ingestion/jobs/:id",
      authenticatedRoute(this.deps.sessionResolver, (_request, params) => this.handleGetJob(params.id!)),
    );
  }

  private async handleUpload(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const content = Buffer.from(IngestionModule.requireString(body, "contentBase64"), "base64");
    const command = UploadDocumentCommand.of(
      IngestionModule.requireString(body, "collectionId"),
      IngestionModule.requireString(body, "filename"),
      IngestionModule.requireString(body, "mimeType"),
      content,
    );
    const job = await this.deps.applicationService.execute(this.deps.uploadDocument, command);
    return { statusCode: HTTP_ACCEPTED, body: { jobId: job.id.value, status: job.status } };
  }

  private async handleGetJob(jobId: string): Promise<RouteResult> {
    const view = await this.deps.applicationService.execute(this.deps.getIngestionJob, jobId);
    if (view === null) {
      return {
        statusCode: HTTP_NOT_FOUND,
        body: { error: "ingestion.jobNotFound", message: "Ingestion job not found" },
      };
    }
    return { statusCode: HTTP_OK, body: view };
  }

  private static requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field },
        "Field '" + field + "' is required",
      );
    }
    return value;
  }
}
