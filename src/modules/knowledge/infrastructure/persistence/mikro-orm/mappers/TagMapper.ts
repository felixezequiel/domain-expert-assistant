import { Tag, type TagScope } from "../../../../domain/aggregates/Tag.ts";
import { TagId } from "../../../../domain/identifiers/TagId.ts";
import { TagEntity } from "../entities/TagEntity.ts";

export class TagMapper {
  public static toOrmEntity(tag: Tag): TagEntity {
    const entity = new TagEntity();
    entity.id = tag.id.value;
    entity.companyId = tag.companyId;
    entity.slug = tag.slug;
    entity.label = tag.label;
    entity.scope = tag.scope;
    return entity;
  }

  public static toDomain(entity: TagEntity): Tag {
    return Tag.reconstitute(
      new TagId(entity.id),
      entity.companyId,
      entity.slug,
      entity.label,
      entity.scope as TagScope,
    );
  }
}
