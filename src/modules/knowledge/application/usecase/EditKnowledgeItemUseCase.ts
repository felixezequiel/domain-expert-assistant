import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type { KnowledgeItemRepositoryPort, KnowledgeVersionRepositoryPort } from "../types.ts";
import type { EditKnowledgeItemCommand } from "../command/EditKnowledgeItemCommand.ts";
import type { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import { snapshotOf } from "../knowledgeVersionSnapshot.ts";

/**
 * Curator edits an item's content, creating a new working version. If the item was
 * published the published pointer stays put — it keeps serving until the new revision is
 * approved (ADR-012). The new snapshot is appended in the same transaction.
 */
export class EditKnowledgeItemUseCase implements UseCase<EditKnowledgeItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator"];

  private readonly itemRepository: KnowledgeItemRepositoryPort;
  private readonly versionRepository: KnowledgeVersionRepositoryPort;
  private readonly clock: () => Date;

  constructor(
    itemRepository: KnowledgeItemRepositoryPort,
    versionRepository: KnowledgeVersionRepositoryPort,
    clock: () => Date = () => new Date(),
  ) {
    this.itemRepository = itemRepository;
    this.versionRepository = versionRepository;
    this.clock = clock;
  }

  public async execute(command: EditKnowledgeItemCommand): Promise<KnowledgeItem> {
    const editorId = getCurrentActor()?.actorId ?? null;
    if (editorId === null) {
      throw new Error("Cannot edit without an actor in the context");
    }
    const item = await this.itemRepository.findById(command.itemId);
    if (item === null) {
      throw new Error("Knowledge item not found: " + command.itemId.value);
    }

    item.edit(command.title, command.body, command.sensitivity, editorId);
    await this.versionRepository.append(snapshotOf(item, editorId, this.clock()));
    return item;
  }
}
