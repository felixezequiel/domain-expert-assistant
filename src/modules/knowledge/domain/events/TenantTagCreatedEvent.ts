import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class TenantTagCreatedEvent extends BaseDomainEvent {
  public readonly eventName = "TenantTagCreated";
  public readonly slug: string;
  public readonly label: string;

  constructor(aggregateId: string, slug: string, label: string, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.slug = slug;
    this.label = label;
  }
}
