import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import { readSessionToken } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";
import type { UploadDocumentUseCase } from "../application/usecase/UploadDocumentUseCase.ts";
import type { GetIngestionJobUseCase } from "../application/usecase/GetIngestionJobUseCase.ts";
import { UploadDocumentCommand } from "../application/command/IngestionCommands.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";
import { toErrorResponse } from "../../../shared/infrastructure/http/errorResponse.ts";

const HTTP_OK = 200;
const HTTP_ACCEPTED = 202;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

interface RouteResult {
  readonly statusCode: number;
  readonly body: unknown;
}

export interface IngestionModuleDeps {
  readonly applicationService: ApplicationService;
  readonly resolveSession: ResolveSessionUseCase;
  readonly uploadDocument: UploadDocumentUseCase;
  readonly getIngestionJob: GetIngestionJobUseCase;
}

/**
 * Ingestion REST edge. Upload accepts the document as base64 in a JSON body (no multipart
 * in v1) and returns 202 immediately with the job id; the worker processes it async.
 */
export class IngestionModule {
  private readonly deps: IngestionModuleDeps;

  constructor(deps: IngestionModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawPost("/ingestion/uploads", (request, response) => {
      void this.authed(request, response, async () => this.handleUpload(request));
    });
    httpServer.rawGet("/ingestion/jobs/:id", (request, response, params) => {
      void this.authed(request, response, async () => this.handleGetJob(params.id!));
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
      this.respond(response, {
        statusCode: HTTP_UNAUTHORIZED,
        body: { error: "common.unauthorized", message: "Unauthorized" },
      });
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

  private respond(response: ServerResponse, result: RouteResult): void {
    response.writeHead(result.statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result.body));
  }

  private respondError(response: ServerResponse, error: unknown): void {
    this.respond(response, toErrorResponse(error));
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
