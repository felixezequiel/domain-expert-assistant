import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { OrganizationRepositoryPort } from "../types.ts";
import type { SetOrganizationPolicyCommand } from "../command/SetOrganizationPolicyCommand.ts";
import { Organization } from "../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { OrganizationPolicy } from "../../domain/valueObjects/OrganizationPolicy.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";

/**
 * Admin toggles their own org's governance policy. The org id is the actor context tenant
 * — an admin can never reach another org's policy.
 */
export class SetOrganizationPolicyUseCase
  implements UseCase<SetOrganizationPolicyCommand, Organization>
{
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly organizationRepository: OrganizationRepositoryPort;

  constructor(organizationRepository: OrganizationRepositoryPort) {
    this.organizationRepository = organizationRepository;
  }

  public async execute(command: SetOrganizationPolicyCommand): Promise<Organization> {
    const companyId = getCurrentActor()?.companyId;
    if (companyId === null || companyId === undefined) {
      throw new Error("Cannot change policy without a tenant in the actor context");
    }

    const organization = await this.organizationRepository.findById(new OrganizationId(companyId));
    if (organization === null) {
      throw new Error("Organization not found: " + companyId);
    }

    organization.changePolicy(OrganizationPolicy.of(command.requireSeparateReviewer));
    return organization;
  }
}
