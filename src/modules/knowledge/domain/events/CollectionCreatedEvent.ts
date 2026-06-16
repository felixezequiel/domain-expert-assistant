import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class CollectionCreatedEvent extends BaseDomainEvent {
  public readonly eventName = "CollectionCreated";
  public readonly name: string;
  public readonly createdBy: string;

  constructor(aggregateId: string, name: string, createdBy: string, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.name = name;
    this.createdBy = createdBy;
  }
}
