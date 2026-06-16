import { User, type UserStatus } from "../../../../domain/aggregates/User.ts";
import { UserId } from "../../../../domain/identifiers/UserId.ts";
import { Email } from "../../../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../../../domain/valueObjects/PasswordHash.ts";
import { parseRole, type Role } from "../../../../../../shared/domain/Role.ts";
import { UserEntity } from "../entities/UserEntity.ts";

export class UserMapper {
  public static toOrmEntity(user: User): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id.value;
    entity.companyId = user.companyId;
    entity.email = user.email.value;
    entity.displayName = user.displayName.value;
    entity.passwordHash = user.passwordHash === null ? null : user.passwordHash.value;
    entity.roles = user.roles.join(",");
    entity.status = user.status;
    entity.invitationTokenHash = user.invitationTokenHash;
    return entity;
  }

  public static toDomain(entity: UserEntity): User {
    const roles: Array<Role> = [];
    for (const token of entity.roles.split(",")) {
      if (token.length > 0) {
        roles.push(parseRole(token));
      }
    }

    return User.reconstitute(
      new UserId(entity.id),
      entity.companyId,
      new Email(entity.email),
      new DisplayName(entity.displayName),
      entity.passwordHash === null ? null : new PasswordHash(entity.passwordHash),
      roles,
      entity.status as UserStatus,
      entity.invitationTokenHash,
    );
  }
}
