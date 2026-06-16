import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { parseRole, type Role } from "../../../../shared/domain/Role.ts";

/**
 * Invite a new user into the admin's own organization. The target tenant comes from the
 * actor context, never from this command (PRD-1 / ADR-008).
 */
export class InviteUserCommand {
  public readonly userId: UserId;
  public readonly email: Email;
  public readonly displayName: DisplayName;
  public readonly roles: ReadonlyArray<Role>;

  private constructor(userId: UserId, email: Email, displayName: DisplayName, roles: ReadonlyArray<Role>) {
    this.userId = userId;
    this.email = email;
    this.displayName = displayName;
    this.roles = roles;
  }

  public static of(
    userId: string,
    email: string,
    displayName: string,
    roles: ReadonlyArray<string>,
  ): InviteUserCommand {
    const parsedRoles: Array<Role> = [];
    for (const role of roles) {
      parsedRoles.push(parseRole(role));
    }
    return new InviteUserCommand(new UserId(userId), new Email(email), new DisplayName(displayName), parsedRoles);
  }
}
