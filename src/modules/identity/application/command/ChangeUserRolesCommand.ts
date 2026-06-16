import { UserId } from "../../domain/identifiers/UserId.ts";
import { parseRole, type Role } from "../../../../shared/domain/Role.ts";

export class ChangeUserRolesCommand {
  public readonly userId: UserId;
  public readonly roles: ReadonlyArray<Role>;

  private constructor(userId: UserId, roles: ReadonlyArray<Role>) {
    this.userId = userId;
    this.roles = roles;
  }

  public static of(userId: string, roles: ReadonlyArray<string>): ChangeUserRolesCommand {
    const parsedRoles: Array<Role> = [];
    for (const role of roles) {
      parsedRoles.push(parseRole(role));
    }
    return new ChangeUserRolesCommand(new UserId(userId), parsedRoles);
  }
}
