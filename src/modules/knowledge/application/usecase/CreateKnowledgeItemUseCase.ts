import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type {
  KnowledgeItemRepositoryPort,
  CollectionRepositoryPort,
  TagRepositoryPort,
  KnowledgeVersionRepositoryPort,
} from "../types.ts";
import type { CreateKnowledgeItemCommand } from "../command/CreateKnowledgeItemCommand.ts";
import { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import { snapshotOf } from "../knowledgeVersionSnapshot.ts";
import { assertTagsExist } from "../assertTagsExist.ts";

/**
 * Curator creates a draft item (v1) in a collection of their own org, validating that the
 * collection and every tag exist in the tenant's taxonomy. The v1 snapshot is appended in
 * the same transaction (ADR-012).
 */
export class CreateKnowledgeItemUseCase implements UseCase<CreateKnowledgeItemCommand, KnowledgeItem> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator"];

  private readonly itemRepository: KnowledgeItemRepositoryPort;
  private readonly collectionRepository: CollectionRepositoryPort;
  private readonly tagRepository: TagRepositoryPort;
  private readonly versionRepository: KnowledgeVersionRepositoryPort;
  private readonly clock: () => Date;

  constructor(
    itemRepository: KnowledgeItemRepositoryPort,
    collectionRepository: CollectionRepositoryPort,
    tagRepository: TagRepositoryPort,
    versionRepository: KnowledgeVersionRepositoryPort,
    clock: () => Date = () => new Date(),
  ) {
    this.itemRepository = itemRepository;
    this.collectionRepository = collectionRepository;
    this.tagRepository = tagRepository;
    this.versionRepository = versionRepository;
    this.clock = clock;
  }

  public async execute(command: CreateKnowledgeItemCommand): Promise<KnowledgeItem> {
    const actor = getCurrentActor();
    const companyId = actor?.companyId ?? null;
    const authorId = actor?.actorId ?? null;
    if (companyId === null || authorId === null) {
      throw new Error("Cannot create a knowledge item without a tenant/actor in the context");
    }

    if ((await this.collectionRepository.findById(command.collectionId)) === null) {
      throw new Error("Collection not found: " + command.collectionId.value);
    }
    await assertTagsExist(this.tagRepository, command.tagIds);

    const item = KnowledgeItem.create(
      command.itemId,
      companyId,
      command.collectionId,
      command.title,
      command.body,
      command.tagIds,
      command.sensitivity,
      authorId,
    );
    await this.versionRepository.append(snapshotOf(item, authorId, this.clock()));
    return item;
  }
}
