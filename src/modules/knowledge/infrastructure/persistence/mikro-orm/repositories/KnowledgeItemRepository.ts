import type {
  KnowledgeItemRepositoryPort,
  KnowledgeItemFilter,
} from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { KnowledgeItem } from "../../../../domain/aggregates/KnowledgeItem.ts";
import type { KnowledgeItemId } from "../../../../domain/identifiers/KnowledgeItemId.ts";
import { KnowledgeItemEntity } from "../entities/KnowledgeItemEntity.ts";
import { KnowledgeItemMapper } from "../mappers/KnowledgeItemMapper.ts";

export class KnowledgeItemRepository implements KnowledgeItemRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(item: KnowledgeItem): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(KnowledgeItemEntity, KnowledgeItemMapper.toOrmEntity(item));
  }

  public async findById(id: KnowledgeItemId): Promise<KnowledgeItem | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(KnowledgeItemEntity, { id: id.value });
    return entity === null ? null : KnowledgeItemMapper.toDomain(entity);
  }

  public async list(filter: KnowledgeItemFilter): Promise<ReadonlyArray<KnowledgeItem>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const where: Record<string, string> = {};
    if (filter.collectionId !== null) {
      where["collectionId"] = filter.collectionId;
    }
    if (filter.status !== null) {
      where["status"] = filter.status;
    }
    const entities = await entityManager.find(KnowledgeItemEntity, where);
    const items: Array<KnowledgeItem> = [];
    for (const entity of entities) {
      items.push(KnowledgeItemMapper.toDomain(entity));
    }
    return items;
  }

  public async existsInCollection(collectionId: string): Promise<boolean> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    return (await entityManager.findOne(KnowledgeItemEntity, { collectionId })) !== null;
  }

  /**
   * Tag ids are stored comma-joined, so a `LIKE` narrows to candidate rows; we then confirm
   * exact membership in the parsed list to avoid substring false positives (e.g. "tag-1" vs
   * "tag-10"). The company filter scopes the scan to the tenant's own items.
   */
  public async isTagInUse(tagId: string): Promise<boolean> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const candidates = await entityManager.find(KnowledgeItemEntity, {
      tagIds: { $like: `%${tagId}%` },
    });
    for (const entity of candidates) {
      if (entity.tagIds.split(",").includes(tagId)) {
        return true;
      }
    }
    return false;
  }
}
