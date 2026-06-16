import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import type { TenantScoped } from "../../../../shared/domain/TenantScoped.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserId } from "../identifiers/UserId.ts";
import type { Email } from "../valueObjects/Email.ts";
import type { DisplayName } from "../valueObjects/DisplayName.ts";
import type { PasswordHash } from "../valueObjects/PasswordHash.ts";
import { UserInvitedEvent } from "../events/UserInvitedEvent.ts";
import { UserActivatedEvent } from "../events/UserActivatedEvent.ts";
import { UserRolesChangedEvent } from "../events/UserRolesChangedEvent.ts";
import { UserDisabledEvent } from "../events/UserDisabledEvent.ts";

export type UserStatus = "invited" | "active" | "disabled";

interface UserProps {
  readonly companyId: string;
  readonly email: Email;
  readonly displayName: DisplayName;
  passwordHash: PasswordHash | null;
  roles: ReadonlyArray<Role>;
  status: UserStatus;
}

/**
 * A human principal, bound to exactly one organization (tenant). Lifecycle:
 * invited → active (on accepting an invitation, which sets the password) → disabled.
 *
 * Domain invariants enforced here: at least one role; an active user has a password;
 * activation only from invited. The "cannot disable/demote the last Admin" rule spans
 * all users of an org, so it lives in the use case, not the aggregate (ADR-011).
 */
export class User extends AggregateRoot<UserId, UserProps> implements TenantScoped {
  public get companyId(): string {
    return this.props.companyId;
  }

  public get email(): Email {
    return this.props.email;
  }

  public get displayName(): DisplayName {
    return this.props.displayName;
  }

  public get passwordHash(): PasswordHash | null {
    return this.props.passwordHash;
  }

  public get roles(): ReadonlyArray<Role> {
    return this.props.roles;
  }

  public get status(): UserStatus {
    return this.props.status;
  }

  public isAdmin(): boolean {
    return this.props.roles.includes("admin");
  }

  public static invite(
    id: UserId,
    companyId: string,
    email: Email,
    displayName: DisplayName,
    roles: ReadonlyArray<Role>,
  ): User {
    const dedupedRoles = User.requireAtLeastOneRole(roles);
    const user = new User(id, {
      companyId,
      email,
      displayName,
      passwordHash: null,
      roles: dedupedRoles,
      status: "invited",
    });
    user.addDomainEvent(new UserInvitedEvent(id.value, email.value, dedupedRoles));
    return user;
  }

  public static reconstitute(
    id: UserId,
    companyId: string,
    email: Email,
    displayName: DisplayName,
    passwordHash: PasswordHash | null,
    roles: ReadonlyArray<Role>,
    status: UserStatus,
  ): User {
    return new User(id, {
      companyId,
      email,
      displayName,
      passwordHash,
      roles: User.dedupe(roles),
      status,
    });
  }

  public activate(passwordHash: PasswordHash): void {
    if (this.props.status !== "invited") {
      throw new Error("User is not invited; cannot activate: " + this.id.value);
    }
    this.props.passwordHash = passwordHash;
    this.props.status = "active";
    this.addDomainEvent(new UserActivatedEvent(this.id.value));
  }

  public changeRoles(roles: ReadonlyArray<Role>): void {
    const dedupedRoles = User.requireAtLeastOneRole(roles);
    this.props.roles = dedupedRoles;
    this.addDomainEvent(new UserRolesChangedEvent(this.id.value, dedupedRoles));
  }

  public disable(): void {
    if (this.props.status === "disabled") {
      return;
    }
    this.props.status = "disabled";
    this.addDomainEvent(new UserDisabledEvent(this.id.value));
  }

  private static requireAtLeastOneRole(roles: ReadonlyArray<Role>): ReadonlyArray<Role> {
    const deduped = User.dedupe(roles);
    if (deduped.length === 0) {
      throw new Error("A user must have at least one role");
    }
    return deduped;
  }

  private static dedupe(roles: ReadonlyArray<Role>): ReadonlyArray<Role> {
    const seen = new Set<Role>();
    const result: Array<Role> = [];
    for (const role of roles) {
      if (!seen.has(role)) {
        seen.add(role);
        result.push(role);
      }
    }
    return result;
  }
}
