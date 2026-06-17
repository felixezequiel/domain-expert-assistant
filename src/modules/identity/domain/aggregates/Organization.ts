import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import type { TenantScoped } from "../../../../shared/domain/TenantScoped.ts";
import type { OrganizationId } from "../identifiers/OrganizationId.ts";
import type { OrganizationName } from "../valueObjects/OrganizationName.ts";
import { OrganizationPolicy } from "../valueObjects/OrganizationPolicy.ts";
import { OrganizationProvisionedEvent } from "../events/OrganizationProvisionedEvent.ts";
import { OrganizationPolicyChangedEvent } from "../events/OrganizationPolicyChangedEvent.ts";

// The org is `active` from provisioning; v1 has no suspend operation (PRD-1 §2), so this is
// a single-value type kept for forward extensibility rather than a real lifecycle.
export type OrganizationStatus = "active";

interface OrganizationProps {
  readonly name: OrganizationName;
  status: OrganizationStatus;
  policy: OrganizationPolicy;
  readonly createdAt: Date;
}

/**
 * The tenant — the root of isolation. Its `companyId` is its own id, so actions an Admin
 * takes on the organization attribute to that tenant in the audit trail (ADR-008). The
 * `organizations` table itself is NOT company-filtered (it IS the tenant); the filter
 * applies to everything beneath it (PRD-1 §9).
 */
export class Organization extends AggregateRoot<OrganizationId, OrganizationProps> implements TenantScoped {
  public get companyId(): string {
    return this.id.value;
  }

  public get name(): OrganizationName {
    return this.props.name;
  }

  public get status(): OrganizationStatus {
    return this.props.status;
  }

  public get policy(): OrganizationPolicy {
    return this.props.policy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public static provision(id: OrganizationId, name: OrganizationName): Organization {
    const organization = new Organization(id, {
      name,
      status: "active",
      policy: OrganizationPolicy.default(),
      createdAt: new Date(),
    });
    organization.addDomainEvent(new OrganizationProvisionedEvent(id.value, name.value));
    return organization;
  }

  public static reconstitute(
    id: OrganizationId,
    name: OrganizationName,
    status: OrganizationStatus,
    policy: OrganizationPolicy,
    createdAt: Date,
  ): Organization {
    return new Organization(id, { name, status, policy, createdAt });
  }

  public changePolicy(policy: OrganizationPolicy): void {
    if (policy.requireSeparateReviewer === this.props.policy.requireSeparateReviewer) {
      return;
    }
    this.props.policy = policy;
    this.addDomainEvent(new OrganizationPolicyChangedEvent(this.id.value, policy.requireSeparateReviewer));
  }
}
