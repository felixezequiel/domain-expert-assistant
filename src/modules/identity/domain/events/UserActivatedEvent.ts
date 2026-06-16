import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class UserActivatedEvent extends BaseDomainEvent {
  public readonly eventName = "UserActivated";

  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}
