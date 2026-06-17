import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { OrganizationRepositoryPort } from "../types.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/** The tenant's current governance policy, so the console can pre-fill the toggle. */
export interface OrgPolicyView {
  readonly organizationId: string;
  readonly requireSeparateReviewer: boolean;
}

/**
 * Reads the current organization policy so the admin screen shows the live value instead of
 * a write-only checkbox that always starts unchecked. The setter (SetOrganizationPolicyUseCase)
 * stays the authoritative write path.
 */
export class ReadOrgPolicyUseCase implements UseCase<void, OrgPolicyView> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly organizationRepository: OrganizationRepositoryPort;

  constructor(organizationRepository: OrganizationRepositoryPort) {
    this.organizationRepository = organizationRepository;
  }

  public async execute(): Promise<OrgPolicyView> {
    const companyId = getCurrentActor()?.companyId ?? null;
    if (companyId === null) {
      throw new DomainError(
        "identity.readPolicyWithoutTenant",
        "internal",
        undefined,
        "Cannot read the policy without a tenant in the context",
      );
    }

    const organization = await this.organizationRepository.findById(new OrganizationId(companyId));
    if (organization === null) {
      throw new DomainError(
        "identity.organizationNotFound",
        "validation",
        { id: companyId },
        "Organization not found: " + companyId,
      );
    }

    return {
      organizationId: organization.id.value,
      requireSeparateReviewer: organization.policy.requireSeparateReviewer,
    };
  }
}
