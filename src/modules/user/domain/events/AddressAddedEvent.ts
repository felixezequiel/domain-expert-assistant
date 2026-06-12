import { randomUUID } from "node:crypto";
import type { DomainEvent } from "../../../../shared/domain/events/DomainEvent.ts";

export class AddressAddedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "AddressAdded";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;
  public readonly addressId: string;

  constructor(aggregateId: string, addressId: string, causationId: string | null = null) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.addressId = addressId;
    this.occurredAt = new Date();
    this.causationId = causationId;
  }
}
