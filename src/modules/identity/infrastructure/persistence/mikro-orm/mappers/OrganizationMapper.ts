import { Organization } from "../../../../domain/aggregates/Organization.ts";
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
    // v1 has a single org status (`active`); the persisted column is kept for forward
    // extensibility but never produces another value (PRD-1 §2).
    return Organization.reconstitute(
      new OrganizationId(entity.id),
      new OrganizationName(entity.name),
      "active",
      OrganizationPolicy.of(entity.requireSeparateReviewer),
      new Date(entity.createdAt),
    );
  }
}
