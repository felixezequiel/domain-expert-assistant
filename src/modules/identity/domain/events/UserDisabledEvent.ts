import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class UserDisabledEvent extends BaseDomainEvent {
  public readonly eventName = "UserDisabled";

  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}
