import type { CollectionRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { Collection } from "../../../../domain/aggregates/Collection.ts";
import type { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";
import { CollectionEntity } from "../entities/CollectionEntity.ts";
import { CollectionMapper } from "../mappers/CollectionMapper.ts";

export class CollectionRepository implements CollectionRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(collection: Collection): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(CollectionEntity, CollectionMapper.toOrmEntity(collection));
  }

  public async findById(id: CollectionId): Promise<Collection | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(CollectionEntity, { id: id.value });
    return entity === null ? null : CollectionMapper.toDomain(entity);
  }

  public async existsByName(name: string): Promise<boolean> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    return (await entityManager.findOne(CollectionEntity, { name })) !== null;
  }

  public async listByCompany(): Promise<ReadonlyArray<Collection>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(CollectionEntity, {});
    const collections: Array<Collection> = [];
    for (const entity of entities) {
      collections.push(CollectionMapper.toDomain(entity));
    }
    return collections;
  }
}
