import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import type { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import type { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import type {
  KnowledgeItemRepositoryPort,
  CollectionRepositoryPort,
  TagRepositoryPort,
  KnowledgeVersionRepositoryPort,
} from "../types.ts";
import type {
  RollbackToVersionCommand,
  RetagItemCommand,
  MoveItemToCollectionCommand,
} from "../command/ContentCommands.ts";
import { snapshotOf } from "../knowledgeVersionSnapshot.ts";
import { assertTagsExist } from "../assertTagsExist.ts";

function requireActorId(): string {
  const actorId = getCurrentActor()?.actorId ?? null;
  if (actorId === null) {
    throw new Error("Missing actor in the context");
  }
  return actorId;
}

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

export class RollbackToVersionUseCase implements UseCase<RollbackToVersionCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator", "reviewer"];
  constructor(
    private readonly itemRepository: KnowledgeItemRepositoryPort,
    private readonly versionRepository: KnowledgeVersionRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async execute(command: RollbackToVersionCommand): Promise<KnowledgeItem> {
    const editorId = requireActorId();
    const item = await loadItem(this.itemRepository, command.itemId);
    const snapshot = await this.versionRepository.findByItemAndNumber(item.id.value, command.versionNumber);
    if (snapshot === null) {
      throw new Error("Version not found: " + command.versionNumber);
    }
    const tagIds: Array<TagId> = [];
    for (const tagId of snapshot.tagIds) {
      tagIds.push(new TagId(tagId));
    }
    item.rollbackTo(
      command.versionNumber,
      new Title(snapshot.title),
      new KnowledgeBody(snapshot.body),
      tagIds,
      SensitivityLevel.of(snapshot.sensitivity),
      editorId,
    );
    await this.versionRepository.append(snapshotOf(item, editorId, this.clock()));
    return item;
  }
}

export class RetagItemUseCase implements UseCase<RetagItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator"];
  constructor(
    private readonly itemRepository: KnowledgeItemRepositoryPort,
    private readonly tagRepository: TagRepositoryPort,
    private readonly versionRepository: KnowledgeVersionRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async execute(command: RetagItemCommand): Promise<KnowledgeItem> {
    const editorId = requireActorId();
    await assertTagsExist(this.tagRepository, command.tagIds);
    const item = await loadItem(this.itemRepository, command.itemId);
    item.retag(command.tagIds, editorId);
    await this.versionRepository.append(snapshotOf(item, editorId, this.clock()));
    return item;
  }
}

export class MoveItemToCollectionUseCase implements UseCase<MoveItemToCollectionCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator"];
  constructor(
    private readonly itemRepository: KnowledgeItemRepositoryPort,
    private readonly collectionRepository: CollectionRepositoryPort,
  ) {}

  public async execute(command: MoveItemToCollectionCommand): Promise<KnowledgeItem> {
    if ((await this.collectionRepository.findById(command.collectionId)) === null) {
      throw new Error("Collection not found: " + command.collectionId.value);
    }
    const item = await loadItem(this.itemRepository, command.itemId);
    item.moveToCollection(command.collectionId);
    return item;
  }
}
