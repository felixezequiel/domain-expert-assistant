import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class CollectionRenamedEvent extends BaseDomainEvent {
  public readonly eventName = "CollectionRenamed";
  public readonly name: string;

  constructor(aggregateId: string, name: string, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.name = name;
  }
}
