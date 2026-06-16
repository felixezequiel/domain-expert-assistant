import { randomUUID } from "node:crypto";
import type { DomainEvent } from "./DomainEvent.ts";
import type { ActorType } from "./ActorType.ts";

/**
 * Base class for domain events. Provides the common identity/timestamp fields and
 * declares the envelope fields (ADR-008) as first-class, own enumerable properties
 * initialised to null. The domain never sets the envelope — `ApplicationService`
 * stamps it between drain and dispatch — so subclasses only describe their own payload.
 *
 * Declared mutable here (not `readonly`) so the enrichment step can stamp them; the
 * `DomainEvent` contract still exposes them as readonly to every consumer.
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public abstract readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;
  public companyId: string | null = null;
  public actorId: string | null = null;
  public actorType: ActorType | null = null;

  protected constructor(aggregateId: string, causationId: string | null = null) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
    this.causationId = causationId;
  }
}
