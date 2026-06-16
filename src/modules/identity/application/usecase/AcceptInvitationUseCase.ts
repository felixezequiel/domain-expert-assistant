import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { UserRepositoryPort, PasswordHasherPort, OpaqueSecretPort } from "../types.ts";
import type { AcceptInvitationCommand } from "../command/AcceptInvitationCommand.ts";
import type { User } from "../../domain/aggregates/User.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";
import { InvalidInvitationError } from "../errors.ts";

/**
 * The invitee (not yet logged in) sets their password using the one-time token. Run by
 * the edge in a system scope. Emits UserActivated through the normal pipeline so the
 * activation is audited; the token is single-use (cleared on activation).
 */
export class AcceptInvitationUseCase implements UseCase<AcceptInvitationCommand, User> {
  private readonly userRepository: UserRepositoryPort;
  private readonly passwordHasher: PasswordHasherPort;
  private readonly opaqueSecret: OpaqueSecretPort;

  constructor(
    userRepository: UserRepositoryPort,
    passwordHasher: PasswordHasherPort,
    opaqueSecret: OpaqueSecretPort,
  ) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.opaqueSecret = opaqueSecret;
  }

  public async execute(command: AcceptInvitationCommand): Promise<User> {
    const tokenHash = this.opaqueSecret.hash(command.token);
    const user = await this.userRepository.findByInvitationTokenHash(tokenHash);
    if (user === null || user.status !== "invited") {
      throw new InvalidInvitationError();
    }

    const passwordHash = new PasswordHash(await this.passwordHasher.hash(command.password));
    user.activate(passwordHash);
    return user;
  }
}
