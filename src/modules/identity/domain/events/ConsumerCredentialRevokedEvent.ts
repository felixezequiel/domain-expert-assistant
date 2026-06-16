import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class ConsumerCredentialRevokedEvent extends BaseDomainEvent {
  public readonly eventName = "ConsumerCredentialRevoked";

  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}
