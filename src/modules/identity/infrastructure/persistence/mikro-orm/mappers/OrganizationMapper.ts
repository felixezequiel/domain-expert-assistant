import { Organization, type OrganizationStatus } from "../../../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../../../domain/valueObjects/OrganizationName.ts";
import { OrganizationPolicy } from "../../../../domain/valueObjects/OrganizationPolicy.ts";
import { OrganizationEntity } from "../entities/OrganizationEntity.ts";

export class OrganizationMapper {
  public static toOrmEntity(organization: Organization): OrganizationEntity {
    const entity = new OrganizationEntity();
    entity.id = organization.id.value;
    entity.name = organization.name.value;
    entity.status = organization.status;
    entity.requireSeparateReviewer = organization.policy.requireSeparateReviewer;
    entity.createdAt = organization.createdAt.toISOString();
    return entity;
  }

  public static toDomain(entity: OrganizationEntity): Organization {
    return Organization.reconstitute(
      new OrganizationId(entity.id),
      new OrganizationName(entity.name),
      entity.status as OrganizationStatus,
      OrganizationPolicy.of(entity.requireSeparateReviewer),
      new Date(entity.createdAt),
    );
  }
}
