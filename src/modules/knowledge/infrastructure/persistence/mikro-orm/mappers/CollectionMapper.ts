import { Collection } from "../../../../domain/aggregates/Collection.ts";
import { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";
import { CollectionEntity } from "../entities/CollectionEntity.ts";

export class CollectionMapper {
  public static toOrmEntity(collection: Collection): CollectionEntity {
    const entity = new CollectionEntity();
    entity.id = collection.id.value;
    entity.companyId = collection.companyId;
    entity.name = collection.name;
    entity.description = collection.description;
    entity.createdBy = collection.createdBy;
    return entity;
  }

  public static toDomain(entity: CollectionEntity): Collection {
    return Collection.reconstitute(
      new CollectionId(entity.id),
      entity.companyId,
      entity.name,
      entity.description,
      entity.createdBy,
    );
  }
}
