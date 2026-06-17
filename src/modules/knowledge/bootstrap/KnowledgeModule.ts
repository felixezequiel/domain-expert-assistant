import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { SessionResolverPort } from "../../../shared/application/ports/SessionResolverPort.ts";
import {
  authenticatedRoute,
  type RouteResult,
} from "../../../shared/infrastructure/http/authenticatedRoute.ts";

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

export interface KnowledgeModuleDeps {
  readonly applicationService: ApplicationService;
  // Resolves the session cookie to the authenticated Actor at the shared edge
  // (`authenticatedRoute`); Knowledge no longer re-implements session lookup (ADR-011 amendment).
  readonly sessionResolver: SessionResolverPort;
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
 * Knowledge curation REST edge (PRD-2 §8). Every route is wrapped by the shared
 * `authenticatedRoute`, which resolves the session cookie to the Actor via `SessionResolverPort`
 * and opens the Actor Context (ADR-011 amendment). Commands run through ApplicationService, whose authorize step enforces
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
    const authed = (handler: Parameters<typeof authenticatedRoute>[1]) =>
      authenticatedRoute(this.deps.sessionResolver, handler);

    httpServer.rawPost("/items", authed((request) => this.handleCreateItem(request)));
    httpServer.rawPut("/items/:id", authed((request, params) => this.handleEditItem(request, params.id!)));
    httpServer.rawPost("/items/:id/submit", authed((_request, params) => this.handleSubmit(params.id!)));
    httpServer.rawPost("/items/:id/approve", authed((_request, params) => this.handleApprove(params.id!)));
    httpServer.rawPost("/items/:id/reject", authed((request, params) => this.handleReject(request, params.id!)));
    httpServer.rawPost("/items/:id/deprecate", authed((_request, params) => this.handleDeprecate(params.id!)));
    httpServer.rawPost("/items/:id/archive", authed((_request, params) => this.handleArchive(params.id!)));
    httpServer.rawPost("/items/:id/rollback", authed((request, params) => this.handleRollback(request, params.id!)));
    httpServer.rawPost("/items/:id/retag", authed((request, params) => this.handleRetag(request, params.id!)));
    httpServer.rawPost("/items/:id/move", authed((request, params) => this.handleMove(request, params.id!)));

    httpServer.rawGet("/items", authed((request) => this.handleListItems(request)));
    httpServer.rawGet("/items/:id/versions", authed((_request, params) => this.handleVersionHistory(params.id!)));
    httpServer.rawGet("/items/:id", authed((_request, params) => this.handleGetItem(params.id!)));

    httpServer.rawPost("/collections", authed((request) => this.handleCreateCollection(request)));
    httpServer.rawPut(
      "/collections/:id",
      authed((request, params) => this.handleRenameCollection(request, params.id!)),
    );
    httpServer.rawGet("/collections", authed(() => this.handleListCollections()));

    httpServer.rawPost("/tags", authed((request) => this.handleCreateTag(request)));
    httpServer.rawDelete("/tags/:id", authed((_request, params) => this.handleRemoveTag(params.id!)));
    httpServer.rawGet("/tags", authed(() => this.handleListTags()));
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
