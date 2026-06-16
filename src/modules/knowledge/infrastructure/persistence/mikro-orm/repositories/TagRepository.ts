import type { TagRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { Tag } from "../../../../domain/aggregates/Tag.ts";
import type { TagId } from "../../../../domain/identifiers/TagId.ts";
import { TagEntity } from "../entities/TagEntity.ts";
import { TagMapper } from "../mappers/TagMapper.ts";

export class TagRepository implements TagRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(tag: Tag): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(TagEntity, TagMapper.toOrmEntity(tag));
    await entityManager.flush();
  }

  public async findById(id: TagId): Promise<Tag | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(TagEntity, { id: id.value });
    return entity === null ? null : TagMapper.toDomain(entity);
  }

  public async existsBySlug(slug: string): Promise<boolean> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    return (await entityManager.findOne(TagEntity, { slug })) !== null;
  }

  public async listForTenant(): Promise<ReadonlyArray<Tag>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(TagEntity, {});
    const tags: Array<Tag> = [];
    for (const entity of entities) {
      tags.push(TagMapper.toDomain(entity));
    }
    return tags;
  }

  public async existingTagIds(tagIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
    if (tagIds.length === 0) {
      return [];
    }
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(TagEntity, { id: { $in: [...tagIds] } });
    const existing: Array<string> = [];
    for (const entity of entities) {
      existing.push(entity.id);
    }
    return existing;
  }
}
