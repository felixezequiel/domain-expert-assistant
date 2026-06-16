import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class ConsumerCredentialRotatedEvent extends BaseDomainEvent {
  public readonly eventName = "ConsumerCredentialRotated";
  public readonly keyPrefix: string;

  constructor(aggregateId: string, keyPrefix: string, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.keyPrefix = keyPrefix;
  }
}
