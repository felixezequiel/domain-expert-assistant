import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserRepositoryPort } from "../types.ts";
import type { ChangeUserRolesCommand } from "../command/ChangeUserRolesCommand.ts";
import type { User } from "../../domain/aggregates/User.ts";
import { LastAdminError } from "../errors.ts";

/**
 * Admin changes a user's roles. Refuses to strip admin from the org's last active admin
 * (cross-aggregate domain rule, ADR-011). Cross-tenant access is blocked by the read
 * filter + the write cross-check, not re-checked here.
 */
export class ChangeUserRolesUseCase implements UseCase<ChangeUserRolesCommand, User> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async execute(command: ChangeUserRolesCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId);
    if (user === null) {
      throw new Error("User not found: " + command.userId.value);
    }

    const losesAdmin = user.isAdmin() && !command.roles.includes("admin");
    if (losesAdmin && user.status === "active") {
      const activeAdmins = await this.userRepository.countActiveAdmins(user.companyId);
      if (activeAdmins <= 1) {
        throw new LastAdminError();
      }
    }

    user.changeRoles(command.roles);
    return user;
  }
}
