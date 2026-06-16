import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class ConsumerCredentialIssuedEvent extends BaseDomainEvent {
  public readonly eventName = "ConsumerCredentialIssued";
  public readonly keyPrefix: string;
  public readonly createdBy: string;

  constructor(aggregateId: string, keyPrefix: string, createdBy: string, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.keyPrefix = keyPrefix;
    this.createdBy = createdBy;
  }
}
