import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserRepositoryPort, SessionRepositoryPort } from "../types.ts";
import type { DisableUserCommand } from "../command/DisableUserCommand.ts";
import type { User } from "../../domain/aggregates/User.ts";
import { LastAdminError } from "../errors.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/**
 * Admin disables a user. Refuses to disable the org's last active admin. Disabling
 * revokes the user's sessions immediately (ADR-010); ResolveSession also rejects a
 * disabled user per request, so revocation takes effect at once either way.
 */
export class DisableUserUseCase implements UseCase<DisableUserCommand, User> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly userRepository: UserRepositoryPort;
  private readonly sessionRepository: SessionRepositoryPort;

  constructor(userRepository: UserRepositoryPort, sessionRepository: SessionRepositoryPort) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

  public async execute(command: DisableUserCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId);
    if (user === null) {
      throw new DomainError(
        "identity.userNotFound",
        "validation",
        { id: command.userId.value },
        "User not found: " + command.userId.value,
      );
    }

    if (user.isAdmin() && user.status === "active") {
      const activeAdmins = await this.userRepository.countActiveAdmins(user.companyId);
      if (activeAdmins <= 1) {
        throw new LastAdminError();
      }
    }

    user.disable();
    await this.sessionRepository.revokeAllForUser(user.id.value);
    return user;
  }
}
