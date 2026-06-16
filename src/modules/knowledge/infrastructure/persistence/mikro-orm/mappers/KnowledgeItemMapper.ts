import { KnowledgeItem } from "../../../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../../../domain/identifiers/TagId.ts";
import { Title } from "../../../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../../../domain/valueObjects/KnowledgeBody.ts";
import type { LifecycleStatus } from "../../../../domain/valueObjects/LifecycleStatus.ts";
import { SensitivityLevel } from "../../../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { KnowledgeItemEntity } from "../entities/KnowledgeItemEntity.ts";

export class KnowledgeItemMapper {
  public static toOrmEntity(item: KnowledgeItem): KnowledgeItemEntity {
    const entity = new KnowledgeItemEntity();
    entity.id = item.id.value;
    entity.companyId = item.companyId;
    entity.collectionId = item.collectionId.value;
    entity.title = item.title.value;
    entity.body = item.body.value;
    entity.tagIds = item.tagIds.map((tagId) => tagId.value).join(",");
    entity.sensitivity = item.sensitivity.name;
    entity.status = item.status;
    entity.currentVersionNumber = item.currentVersionNumber;
    entity.publishedVersionNumber = item.publishedVersionNumber;
    entity.authorId = item.authorId;
    entity.lastEditorId = item.lastEditorId;
    entity.createdAt = item.createdAt.toISOString();
    return entity;
  }

  public static toDomain(entity: KnowledgeItemEntity): KnowledgeItem {
    const tagIds: Array<TagId> = [];
    for (const token of entity.tagIds.split(",")) {
      if (token.length > 0) {
        tagIds.push(new TagId(token));
      }
    }

    return KnowledgeItem.reconstitute({
      id: new KnowledgeItemId(entity.id),
      companyId: entity.companyId,
      collectionId: new CollectionId(entity.collectionId),
      title: new Title(entity.title),
      body: new KnowledgeBody(entity.body),
      tagIds,
      sensitivity: SensitivityLevel.of(entity.sensitivity),
      status: entity.status as LifecycleStatus,
      currentVersionNumber: entity.currentVersionNumber,
      publishedVersionNumber: entity.publishedVersionNumber,
      authorId: entity.authorId,
      lastEditorId: entity.lastEditorId,
      createdAt: new Date(entity.createdAt),
    });
  }
}
