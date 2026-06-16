import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

export class OrganizationPolicyChangedEvent extends BaseDomainEvent {
  public readonly eventName = "OrganizationPolicyChanged";
  public readonly requireSeparateReviewer: boolean;

  constructor(aggregateId: string, requireSeparateReviewer: boolean, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.requireSeparateReviewer = requireSeparateReviewer;
  }
}
