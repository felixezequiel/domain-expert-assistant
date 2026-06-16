import {
  ConsumerCredential,
  type CredentialStatus,
} from "../../../../domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { ConsumerCredentialEntity } from "../entities/ConsumerCredentialEntity.ts";

export class ConsumerCredentialMapper {
  public static toOrmEntity(credential: ConsumerCredential): ConsumerCredentialEntity {
    const entity = new ConsumerCredentialEntity();
    entity.id = credential.id.value;
    entity.companyId = credential.companyId;
    entity.name = credential.name;
    entity.keyPrefix = credential.keyPrefix;
    entity.secretHash = credential.secretHash;
    entity.collectionIds = credential.scope.collectionIds.join(",");
    entity.sensitivityCeiling = credential.scope.sensitivityCeiling.name;
    entity.status = credential.status;
    entity.createdBy = credential.createdBy;
    entity.createdAt = credential.createdAt.toISOString();
    entity.lastUsedAt = credential.lastUsedAt === null ? null : credential.lastUsedAt.toISOString();
    return entity;
  }

  public static toDomain(entity: ConsumerCredentialEntity): ConsumerCredential {
    const collectionIds: Array<string> = [];
    for (const token of entity.collectionIds.split(",")) {
      if (token.length > 0) {
        collectionIds.push(token);
      }
    }

    return ConsumerCredential.reconstitute(
      new CredentialId(entity.id),
      entity.companyId,
      entity.name,
      entity.keyPrefix,
      entity.secretHash,
      CredentialScope.of(collectionIds, SensitivityLevel.of(entity.sensitivityCeiling)),
      entity.status as CredentialStatus,
      entity.createdBy,
      new Date(entity.createdAt),
      entity.lastUsedAt === null ? null : new Date(entity.lastUsedAt),
    );
  }
}
