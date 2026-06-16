import type { OrganizationPolicyPort } from "../../../knowledge/application/types.ts";
import type { OrganizationRepositoryPort } from "../../application/types.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";

/**
 * Cross-module adapter (ADR-013): Knowledge's approval flow needs the org's
 * `requireSeparateReviewer` governance policy, but must not depend on the Identity
 * Organization aggregate. Identity provides this adapter, implementing Knowledge's
 * `OrganizationPolicyPort` against its own `OrganizationRepositoryPort`. The dependency
 * direction is Identity → Knowledge's port interface, which is the intended one.
 *
 * A missing organization yields `false`: the policy can only tighten review, never
 * fabricate one for a tenant that does not exist.
 */
export class OrganizationPolicyAdapter implements OrganizationPolicyPort {
  private readonly organizationRepository: OrganizationRepositoryPort;

  constructor(organizationRepository: OrganizationRepositoryPort) {
    this.organizationRepository = organizationRepository;
  }

  public async requireSeparateReviewer(companyId: string): Promise<boolean> {
    const organization = await this.organizationRepository.findById(new OrganizationId(companyId));
    if (organization === null) {
      return false;
    }
    return organization.policy.requireSeparateReviewer;
  }
}
