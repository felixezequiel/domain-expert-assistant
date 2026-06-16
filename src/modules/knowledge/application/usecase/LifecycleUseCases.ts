import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type { KnowledgeItemRepositoryPort, OrganizationPolicyPort } from "../types.ts";
import type {
  SubmitForReviewCommand,
  ApproveItemCommand,
  RejectItemCommand,
  DeprecateItemCommand,
  ArchiveItemCommand,
} from "../command/LifecycleCommands.ts";
import type { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import type { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";

/**
 * Thin lifecycle-transition use cases (load → guarded domain method). Grouped because they
 * share that shape. Each declares the role allowed to *attempt* the transition (ADR-011);
 * the transition's own rules live in the aggregate (ADR-013).
 */
async function loadItem(
  repository: KnowledgeItemRepositoryPort,
  itemId: KnowledgeItemId,
): Promise<KnowledgeItem> {
  const item = await repository.findById(itemId);
  if (item === null) {
    throw new Error("Knowledge item not found: " + itemId.value);
  }
  return item;
}

export class SubmitForReviewUseCase implements UseCase<SubmitForReviewCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator"];
  constructor(private readonly itemRepository: KnowledgeItemRepositoryPort) {}
  public async execute(command: SubmitForReviewCommand): Promise<KnowledgeItem> {
    const item = await loadItem(this.itemRepository, command.itemId);
    item.submitForReview();
    return item;
  }
}

export class ApproveItemUseCase implements UseCase<ApproveItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["reviewer"];
  constructor(
    private readonly itemRepository: KnowledgeItemRepositoryPort,
    private readonly organizationPolicy: OrganizationPolicyPort,
  ) {}
  public async execute(command: ApproveItemCommand): Promise<KnowledgeItem> {
    const reviewerId = getCurrentActor()?.actorId ?? null;
    if (reviewerId === null) {
      throw new Error("Cannot approve without an actor in the context");
    }
    const item = await loadItem(this.itemRepository, command.itemId);
    const requireSeparateReviewer = await this.organizationPolicy.requireSeparateReviewer(item.companyId);
    item.approve(reviewerId, requireSeparateReviewer);
    return item;
  }
}

export class RejectItemUseCase implements UseCase<RejectItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["reviewer"];
  constructor(private readonly itemRepository: KnowledgeItemRepositoryPort) {}
  public async execute(command: RejectItemCommand): Promise<KnowledgeItem> {
    const item = await loadItem(this.itemRepository, command.itemId);
    item.reject(command.reason);
    return item;
  }
}

export class DeprecateItemUseCase implements UseCase<DeprecateItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["reviewer", "admin"];
  constructor(private readonly itemRepository: KnowledgeItemRepositoryPort) {}
  public async execute(command: DeprecateItemCommand): Promise<KnowledgeItem> {
    const item = await loadItem(this.itemRepository, command.itemId);
    item.deprecate();
    return item;
  }
}

export class ArchiveItemUseCase implements UseCase<ArchiveItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["reviewer", "admin"];
  constructor(private readonly itemRepository: KnowledgeItemRepositoryPort) {}
  public async execute(command: ArchiveItemCommand): Promise<KnowledgeItem> {
    const item = await loadItem(this.itemRepository, command.itemId);
    item.archive();
    return item;
  }
}
