import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/**
 * Accept an invitation: the one-time token authenticates the request (the invitee is not
 * logged in yet) and the chosen password activates the account. Both are plaintext here;
 * the use case hashes the password and the token (ADR-010).
 */
export class AcceptInvitationCommand {
  public readonly token: string;
  public readonly password: string;

  private constructor(token: string, password: string) {
    this.token = token;
    this.password = password;
  }

  public static of(token: string, password: string): AcceptInvitationCommand {
    if (token.length === 0) {
      throw new DomainError(
        "identity.invitationTokenRequired",
        "validation",
        undefined,
        "Invitation token is required",
      );
    }
    if (password.length === 0) {
      throw new DomainError(
        "identity.passwordRequired",
        "validation",
        undefined,
        "Password is required",
      );
    }
    return new AcceptInvitationCommand(token, password);
  }
}
