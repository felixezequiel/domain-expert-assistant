import { randomUUID } from "node:crypto";
import type { DomainEvent } from "../../../../shared/domain/events/DomainEvent.ts";

export class WelcomeEmailFailedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "WelcomeEmailFailed";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;
  public readonly email: string;
  public readonly reason: string;

  constructor(
    aggregateId: string,
    email: string,
    reason: string,
    causationId: string | null = null,
  ) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.email = email;
    this.reason = reason;
    this.occurredAt = new Date();
    this.causationId = causationId;
  }
}
