import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserRepositoryPort, OpaqueSecretPort } from "../types.ts";
import type { InviteUserCommand } from "../command/InviteUserCommand.ts";
import { User } from "../../domain/aggregates/User.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

export interface InviteUserResult {
  readonly user: User;
  readonly invitationToken: string;
}

/**
 * Admin invites a user into their own organization. Generates a one-time invitation
 * token (returned once, to be delivered out of band); only its hash is stored on the
 * invited user. The tenant is taken from the actor context, never the request.
 */
export class InviteUserUseCase implements UseCase<InviteUserCommand, InviteUserResult> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly userRepository: UserRepositoryPort;
  private readonly opaqueSecret: OpaqueSecretPort;

  constructor(userRepository: UserRepositoryPort, opaqueSecret: OpaqueSecretPort) {
    this.userRepository = userRepository;
    this.opaqueSecret = opaqueSecret;
  }

  public async execute(command: InviteUserCommand): Promise<InviteUserResult> {
    const companyId = getCurrentActor()?.companyId;
    if (companyId === null || companyId === undefined) {
      throw new DomainError(
        "identity.inviteWithoutTenant",
        "internal",
        undefined,
        "Cannot invite a user without a tenant in the actor context",
      );
    }
    if (await this.userRepository.existsByEmail(command.email.value)) {
      throw new DomainError(
        "identity.emailAlreadyInUse",
        "validation",
        { email: command.email.value },
        "Email already in use: " + command.email.value,
      );
    }

    const secret = this.opaqueSecret.generate();
    const user = User.invite(
      command.userId,
      companyId,
      command.email,
      command.displayName,
      command.roles,
      this.opaqueSecret.hash(secret.plaintext),
    );

    return { user, invitationToken: secret.plaintext };
  }
}
