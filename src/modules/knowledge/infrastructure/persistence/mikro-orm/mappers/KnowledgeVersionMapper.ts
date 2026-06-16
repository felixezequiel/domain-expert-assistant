import { KnowledgeVersion } from "../../../../domain/entities/KnowledgeVersion.ts";
import { KnowledgeVersionEntity } from "../entities/KnowledgeVersionEntity.ts";

export class KnowledgeVersionMapper {
  /**
   * The version entity carries `companyId` for tenant filtering, but the domain
   * `KnowledgeVersion` is a pure content snapshot without it (ADR-012). The repository
   * supplies the owning item's companyId at append time.
   */
  public static toOrmEntity(version: KnowledgeVersion, companyId: string): KnowledgeVersionEntity {
    const entity = new KnowledgeVersionEntity();
    entity.id = `${version.itemId}:${version.versionNumber}`;
    entity.itemId = version.itemId;
    entity.companyId = companyId;
    entity.versionNumber = version.versionNumber;
    entity.title = version.title;
    entity.body = version.body;
    entity.tagIds = version.tagIds.join(",");
    entity.sensitivity = version.sensitivity;
    entity.createdBy = version.createdBy;
    entity.createdAt = version.createdAt.toISOString();
    return entity;
  }

  public static toDomain(entity: KnowledgeVersionEntity): KnowledgeVersion {
    const tagIds: Array<string> = [];
    for (const token of entity.tagIds.split(",")) {
      if (token.length > 0) {
        tagIds.push(token);
      }
    }

    return new KnowledgeVersion({
      itemId: entity.itemId,
      versionNumber: entity.versionNumber,
      title: entity.title,
      body: entity.body,
      tagIds,
      sensitivity: entity.sensitivity,
      createdBy: entity.createdBy,
      createdAt: new Date(entity.createdAt),
    });
  }
}
