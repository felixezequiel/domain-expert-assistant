import { IngestionJob } from "../../../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../../../domain/valueObjects/MimeType.ts";
import type { IngestionStatus } from "../../../../domain/valueObjects/IngestionStatus.ts";
import { IngestionJobEntity } from "../entities/IngestionJobEntity.ts";

export class IngestionJobMapper {
  public static toOrmEntity(job: IngestionJob): IngestionJobEntity {
    const entity = new IngestionJobEntity();
    entity.id = job.id.value;
    entity.companyId = job.companyId;
    entity.collectionId = job.collectionId;
    entity.filename = job.filename;
    entity.mimeType = job.mimeType.value;
    entity.storageRef = job.storageRef;
    entity.status = job.status;
    entity.createdItemId = job.createdItemId;
    entity.failureReason = job.failureReason;
    entity.createdBy = job.createdBy;
    entity.createdAt = job.createdAt.toISOString();
    return entity;
  }

  public static toDomain(entity: IngestionJobEntity): IngestionJob {
    return IngestionJob.reconstitute({
      id: new IngestionJobId(entity.id),
      companyId: entity.companyId,
      collectionId: entity.collectionId,
      filename: entity.filename,
      mimeType: new MimeType(entity.mimeType),
      storageRef: entity.storageRef,
      status: entity.status as IngestionStatus,
      createdItemId: entity.createdItemId,
      failureReason: entity.failureReason,
      createdBy: entity.createdBy,
      createdAt: new Date(entity.createdAt),
    });
  }
}
