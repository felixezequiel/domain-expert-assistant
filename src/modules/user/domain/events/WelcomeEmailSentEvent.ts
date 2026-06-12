import { randomUUID } from "node:crypto";
import type { DomainEvent } from "../../../../shared/domain/events/DomainEvent.ts";

export class WelcomeEmailSentEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "WelcomeEmailSent";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;
  public readonly email: string;

  constructor(aggregateId: string, email: string, causationId: string | null = null) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.email = email;
    this.occurredAt = new Date();
    this.causationId = causationId;
  }
}
