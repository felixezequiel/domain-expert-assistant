import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import { toErrorResponse } from "../../../shared/infrastructure/http/errorResponse.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import { readSessionToken } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";

import { CreateKnowledgeItemCommand } from "../application/command/CreateKnowledgeItemCommand.ts";
import { EditKnowledgeItemCommand } from "../application/command/EditKnowledgeItemCommand.ts";
import {
  SubmitForReviewCommand,
  ApproveItemCommand,
  RejectItemCommand,
  DeprecateItemCommand,
  ArchiveItemCommand,
} from "../application/command/LifecycleCommands.ts";
import {
  RollbackToVersionCommand,
  RetagItemCommand,
  MoveItemToCollectionCommand,
} from "../application/command/ContentCommands.ts";
import { CreateCollectionCommand, RenameCollectionCommand } from "../application/command/CollectionCommands.ts";
import { CreateTenantTagCommand, RemoveTenantTagCommand } from "../application/command/TagCommands.ts";

import type { CreateKnowledgeItemUseCase } from "../application/usecase/CreateKnowledgeItemUseCase.ts";
import type { EditKnowledgeItemUseCase } from "../application/usecase/EditKnowledgeItemUseCase.ts";
import type {
  SubmitForReviewUseCase,
  ApproveItemUseCase,
  RejectItemUseCase,
  DeprecateItemUseCase,
  ArchiveItemUseCase,
} from "../application/usecase/LifecycleUseCases.ts";
import type {
  RollbackToVersionUseCase,
  RetagItemUseCase,
  MoveItemToCollectionUseCase,
} from "../application/usecase/ItemContentUseCases.ts";
import type { CreateCollectionUseCase, RenameCollectionUseCase } from "../application/usecase/CollectionUseCases.ts";
import type { CreateTenantTagUseCase, RemoveTenantTagUseCase } from "../application/usecase/TagUseCases.ts";
import type {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  GetVersionHistoryUseCase,
  ListCollectionsUseCase,
  ListTagsUseCase,
} from "../application/usecase/KnowledgeQueries.ts";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

interface RouteResult {
  readonly statusCode: number;
  readonly body: unknown;
}

export interface KnowledgeModuleDeps {
  readonly applicationService: ApplicationService;
  // Same cookie + ResolveSession flow as the Identity edge (ADR-008/010) — Knowledge does
  // not re-implement session lookup, it depends on Identity's use case.
  readonly resolveSession: ResolveSessionUseCase;
  readonly createKnowledgeItem: CreateKnowledgeItemUseCase;
  readonly editKnowledgeItem: EditKnowledgeItemUseCase;
  readonly submitForReview: SubmitForReviewUseCase;
  readonly approveItem: ApproveItemUseCase;
  readonly rejectItem: RejectItemUseCase;
  readonly deprecateItem: DeprecateItemUseCase;
  readonly archiveItem: ArchiveItemUseCase;
  readonly rollbackToVersion: RollbackToVersionUseCase;
  readonly retagItem: RetagItemUseCase;
  readonly moveItemToCollection: MoveItemToCollectionUseCase;
  readonly createCollection: CreateCollectionUseCase;
  readonly renameCollection: RenameCollectionUseCase;
  readonly createTenantTag: CreateTenantTagUseCase;
  readonly removeTenantTag: RemoveTenantTagUseCase;
  readonly getKnowledgeItem: GetKnowledgeItemUseCase;
  readonly listKnowledgeItems: ListKnowledgeItemsUseCase;
  readonly getVersionHistory: GetVersionHistoryUseCase;
  readonly listCollections: ListCollectionsUseCase;
  readonly listTags: ListTagsUseCase;
}

/**
 * Knowledge curation REST edge (PRD-2 §8). Every route is authenticated: it reuses the
 * Identity session cookie + ResolveSession flow to open the Actor Context, exactly as the
 * Identity edge does. Commands run through ApplicationService, whose authorize step enforces
 * each use case's `requiredRoles` (ADR-011); queries declare no roles, so any authenticated
 * member of the tenant passes. The org's `requireSeparateReviewer` policy reaches the approve
 * flow through an injected adapter (ADR-013), not through this edge.
 */
export class KnowledgeModule {
  private readonly deps: KnowledgeModuleDeps;

  constructor(deps: KnowledgeModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    httpServer.rawPost("/items", (request, response) => {
      void this.authed(request, response, async () => this.handleCreateItem(request));
    });
    httpServer.rawPut("/items/:id", (request, response, params) => {
      void this.authed(request, response, async () => this.handleEditItem(request, params.id!));
    });
    httpServer.rawPost("/items/:id/submit", (request, response, params) => {
      void this.authed(request, response, async () => this.handleSubmit(params.id!));
    });
    httpServer.rawPost("/items/:id/approve", (request, response, params) => {
      void this.authed(request, response, async () => this.handleApprove(params.id!));
    });
    httpServer.rawPost("/items/:id/reject", (request, response, params) => {
      void this.authed(request, response, async () => this.handleReject(request, params.id!));
    });
    httpServer.rawPost("/items/:id/deprecate", (request, response, params) => {
      void this.authed(request, response, async () => this.handleDeprecate(params.id!));
    });
    httpServer.rawPost("/items/:id/archive", (request, response, params) => {
      void this.authed(request, response, async () => this.handleArchive(params.id!));
    });
    httpServer.rawPost("/items/:id/rollback", (request, response, params) => {
      void this.authed(request, response, async () => this.handleRollback(request, params.id!));
    });
    httpServer.rawPost("/items/:id/retag", (request, response, params) => {
      void this.authed(request, response, async () => this.handleRetag(request, params.id!));
    });
    httpServer.rawPost("/items/:id/move", (request, response, params) => {
      void this.authed(request, response, async () => this.handleMove(request, params.id!));
    });

    httpServer.rawGet("/items", (request, response) => {
      void this.authed(request, response, async () => this.handleListItems(request));
    });
    httpServer.rawGet("/items/:id/versions", (request, response, params) => {
      void this.authed(request, response, async () => this.handleVersionHistory(params.id!));
    });
    httpServer.rawGet("/items/:id", (request, response, params) => {
      void this.authed(request, response, async () => this.handleGetItem(params.id!));
    });

    httpServer.rawPost("/collections", (request, response) => {
      void this.authed(request, response, async () => this.handleCreateCollection(request));
    });
    httpServer.rawPut("/collections/:id", (request, response, params) => {
      void this.authed(request, response, async () => this.handleRenameCollection(request, params.id!));
    });
    httpServer.rawGet("/collections", (request, response) => {
      void this.authed(request, response, async () => this.handleListCollections());
    });

    httpServer.rawPost("/tags", (request, response) => {
      void this.authed(request, response, async () => this.handleCreateTag(request));
    });
    httpServer.rawDelete("/tags/:id", (request, response, params) => {
      void this.authed(request, response, async () => this.handleRemoveTag(params.id!));
    });
    httpServer.rawGet("/tags", (request, response) => {
      void this.authed(request, response, async () => this.handleListTags());
    });
  }

  // --- auth wrapper ---

  private async authed(
    request: IncomingMessage,
    response: ServerResponse,
    run: () => Promise<RouteResult>,
  ): Promise<void> {
    const token = readSessionToken(request.headers.cookie);
    const principal = token === null ? null : await this.deps.resolveSession.execute(token);
    if (principal === null) {
      this.respondError(response, new DomainError("common.unauthorized", "unauthorized", undefined, "Unauthorized"));
      return;
    }
    const actor: Actor = {
      companyId: principal.companyId,
      actorId: principal.actorId,
      actorType: principal.actorType,
      roles: principal.roles,
    };
    await this.runAndRespond(response, () => runWithActor(actor, run));
  }

  private async runAndRespond(response: ServerResponse, run: () => Promise<RouteResult>): Promise<void> {
    try {
      this.respond(response, await run());
    } catch (error) {
      this.respondError(response, error);
    }
  }

  // --- item command handlers ---

  private async handleCreateItem(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = CreateKnowledgeItemCommand.of(
      KnowledgeModule.optionalString(body, "id") ?? randomUUID(),
      KnowledgeModule.requireString(body, "collectionId"),
      KnowledgeModule.requireString(body, "title"),
      KnowledgeModule.requireString(body, "body"),
      KnowledgeModule.requireStringArray(body, "tagIds"),
      KnowledgeModule.requireString(body, "sensitivity"),
    );
    const item = await this.deps.applicationService.execute(this.deps.createKnowledgeItem, command);
    return { statusCode: HTTP_CREATED, body: { id: item.id.value, status: item.status } };
  }

  private async handleEditItem(request: IncomingMessage, itemId: string): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = EditKnowledgeItemCommand.of(
      itemId,
      KnowledgeModule.requireString(body, "title"),
      KnowledgeModule.requireString(body, "body"),
      KnowledgeModule.requireString(body, "sensitivity"),
      KnowledgeModule.requireStringArray(body, "tagIds"),
    );
    const item = await this.deps.applicationService.execute(this.deps.editKnowledgeItem, command);
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleSubmit(itemId: string): Promise<RouteResult> {
    const item = await this.deps.applicationService.execute(
      this.deps.submitForReview,
      SubmitForReviewCommand.of(itemId),
    );
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleApprove(itemId: string): Promise<RouteResult> {
    const item = await this.deps.applicationService.execute(this.deps.approveItem, ApproveItemCommand.of(itemId));
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleReject(request: IncomingMessage, itemId: string): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = RejectItemCommand.of(itemId, KnowledgeModule.requireString(body, "reason"));
    const item = await this.deps.applicationService.execute(this.deps.rejectItem, command);
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleDeprecate(itemId: string): Promise<RouteResult> {
    const item = await this.deps.applicationService.execute(
      this.deps.deprecateItem,
      DeprecateItemCommand.of(itemId),
    );
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleArchive(itemId: string): Promise<RouteResult> {
    const item = await this.deps.applicationService.execute(this.deps.archiveItem, ArchiveItemCommand.of(itemId));
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleRollback(request: IncomingMessage, itemId: string): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = RollbackToVersionCommand.of(itemId, KnowledgeModule.requireNumber(body, "versionNumber"));
    const item = await this.deps.applicationService.execute(this.deps.rollbackToVersion, command);
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleRetag(request: IncomingMessage, itemId: string): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = RetagItemCommand.of(itemId, KnowledgeModule.requireStringArray(body, "tagIds"));
    const item = await this.deps.applicationService.execute(this.deps.retagItem, command);
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  private async handleMove(request: IncomingMessage, itemId: string): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = MoveItemToCollectionCommand.of(itemId, KnowledgeModule.requireString(body, "collectionId"));
    const item = await this.deps.applicationService.execute(this.deps.moveItemToCollection, command);
    return { statusCode: HTTP_OK, body: { id: item.id.value, status: item.status } };
  }

  // --- item query handlers ---

  private async handleListItems(request: IncomingMessage): Promise<RouteResult> {
    const url = new URL(request.url ?? "/items", "http://localhost");
    const filter = {
      collectionId: url.searchParams.get("collectionId"),
      status: url.searchParams.get("status"),
    };
    const items = await this.deps.applicationService.execute(this.deps.listKnowledgeItems, filter);
    return { statusCode: HTTP_OK, body: { items } };
  }

  private async handleGetItem(itemId: string): Promise<RouteResult> {
    const item = await this.deps.applicationService.execute(this.deps.getKnowledgeItem, itemId);
    if (item === null) {
      // Kept at 400 (not 404) to preserve the current status — this ADR migrates the code, not the status.
      throw new DomainError(
        "knowledge.itemNotFound",
        "validation",
        { id: itemId },
        "Knowledge item not found: " + itemId,
      );
    }
    return { statusCode: HTTP_OK, body: item };
  }

  private async handleVersionHistory(itemId: string): Promise<RouteResult> {
    const versions = await this.deps.applicationService.execute(this.deps.getVersionHistory, itemId);
    return { statusCode: HTTP_OK, body: { versions } };
  }

  // --- collection handlers ---

  private async handleCreateCollection(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = CreateCollectionCommand.of(
      KnowledgeModule.optionalString(body, "id") ?? randomUUID(),
      KnowledgeModule.requireString(body, "name"),
      KnowledgeModule.optionalString(body, "description"),
    );
    const collection = await this.deps.applicationService.execute(this.deps.createCollection, command);
    return { statusCode: HTTP_CREATED, body: { id: collection.id.value, name: collection.name } };
  }

  private async handleRenameCollection(request: IncomingMessage, collectionId: string): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = RenameCollectionCommand.of(collectionId, KnowledgeModule.requireString(body, "name"));
    const collection = await this.deps.applicationService.execute(this.deps.renameCollection, command);
    return { statusCode: HTTP_OK, body: { id: collection.id.value, name: collection.name } };
  }

  private async handleListCollections(): Promise<RouteResult> {
    const collections = await this.deps.applicationService.execute(this.deps.listCollections, undefined);
    return { statusCode: HTTP_OK, body: { collections } };
  }

  // --- tag handlers ---

  private async handleCreateTag(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = CreateTenantTagCommand.of(
      KnowledgeModule.optionalString(body, "id") ?? randomUUID(),
      KnowledgeModule.requireString(body, "label"),
    );
    const tag = await this.deps.applicationService.execute(this.deps.createTenantTag, command);
    return { statusCode: HTTP_CREATED, body: { id: tag.id.value, slug: tag.slug, label: tag.label } };
  }

  private async handleRemoveTag(tagId: string): Promise<RouteResult> {
    const tag = await this.deps.applicationService.execute(this.deps.removeTenantTag, RemoveTenantTagCommand.of(tagId));
    return { statusCode: HTTP_OK, body: { id: tag.id.value, slug: tag.slug } };
  }

  private async handleListTags(): Promise<RouteResult> {
    const tags = await this.deps.applicationService.execute(this.deps.listTags, undefined);
    return { statusCode: HTTP_OK, body: { tags } };
  }

  // --- response helpers ---

  private respond(response: ServerResponse, result: RouteResult): void {
    response.writeHead(result.statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result.body));
  }

  private respondError(response: ServerResponse, error: unknown): void {
    this.respond(response, toErrorResponse(error));
  }

  // --- body parsing helpers ---

  private static requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new DomainError("common.fieldRequired", "validation", { field }, "Field '" + field + "' is required");
    }
    return value;
  }

  private static optionalString(body: Record<string, unknown>, field: string): string | null {
    const value = body[field];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private static requireNumber(body: Record<string, unknown>, field: string): number {
    const value = body[field];
    if (typeof value !== "number") {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field },
        "Field '" + field + "' is required (number)",
      );
    }
    return value;
  }

  private static requireStringArray(body: Record<string, unknown>, field: string): ReadonlyArray<string> {
    const value = body[field];
    if (!Array.isArray(value)) {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field },
        "Field '" + field + "' is required (array)",
      );
    }
    const result: Array<string> = [];
    for (const item of value) {
      if (typeof item !== "string") {
        throw new DomainError(
          "common.fieldInvalid",
          "validation",
          { field },
          "Field '" + field + "' must contain only strings",
        );
      }
      result.push(item);
    }
    return result;
  }
}
