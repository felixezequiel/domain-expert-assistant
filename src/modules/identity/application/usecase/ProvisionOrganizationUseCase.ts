import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { OrganizationRepositoryPort, UserRepositoryPort, PasswordHasherPort } from "../types.ts";
import type { ProvisionOrganizationCommand } from "../command/ProvisionOrganizationCommand.ts";
import { Organization } from "../../domain/aggregates/Organization.ts";
import { User } from "../../domain/aggregates/User.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";

/**
 * Operator-only (runs in a privileged scope opened at the internal operator edge — no
 * role gate here). Creates the tenant and its first Admin, active with a hashed password
 * so they can log in immediately. Both aggregates auto-persist via tracking; the password
 * is never stored in the clear (ADR-010).
 */
export class ProvisionOrganizationUseCase
  implements UseCase<ProvisionOrganizationCommand, Organization>
{
  private readonly organizationRepository: OrganizationRepositoryPort;
  private readonly userRepository: UserRepositoryPort;
  private readonly passwordHasher: PasswordHasherPort;

  constructor(
    organizationRepository: OrganizationRepositoryPort,
    userRepository: UserRepositoryPort,
    passwordHasher: PasswordHasherPort,
  ) {
    this.organizationRepository = organizationRepository;
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  public async execute(command: ProvisionOrganizationCommand): Promise<Organization> {
    if (await this.organizationRepository.existsByName(command.organizationName.value)) {
      throw new Error("Organization name already taken: " + command.organizationName.value);
    }
    if (await this.userRepository.existsByEmail(command.adminEmail.value)) {
      throw new Error("Email already in use: " + command.adminEmail.value);
    }

    const organization = Organization.provision(command.organizationId, command.organizationName);

    const passwordHash = new PasswordHash(await this.passwordHasher.hash(command.adminPassword));
    const admin = User.invite(
      command.adminUserId,
      command.organizationId.value,
      command.adminEmail,
      command.adminDisplayName,
      ["admin"],
    );
    admin.activate(passwordHash);

    return organization;
  }
}
