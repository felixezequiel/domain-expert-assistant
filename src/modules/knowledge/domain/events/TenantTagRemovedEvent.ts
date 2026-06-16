import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class TenantTagRemovedEvent extends BaseDomainEvent {
  public readonly eventName = "TenantTagRemoved";

  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}
