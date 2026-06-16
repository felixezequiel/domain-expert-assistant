import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";
import type { Role } from "../../../../shared/domain/Role.ts";

export class UserInvitedEvent extends BaseDomainEvent {
  public readonly eventName = "UserInvited";
  public readonly email: string;
  public readonly roles: ReadonlyArray<Role>;

  constructor(aggregateId: string, email: string, roles: ReadonlyArray<Role>, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.email = email;
    this.roles = roles;
  }
}
