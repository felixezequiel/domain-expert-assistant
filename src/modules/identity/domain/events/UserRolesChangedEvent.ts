import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";
import type { Role } from "../../../../shared/domain/Role.ts";

export class UserRolesChangedEvent extends BaseDomainEvent {
  public readonly eventName = "UserRolesChanged";
  public readonly roles: ReadonlyArray<Role>;

  constructor(aggregateId: string, roles: ReadonlyArray<Role>, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.roles = roles;
  }
}
