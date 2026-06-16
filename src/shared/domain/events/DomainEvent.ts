import type { ActorType } from "./ActorType.ts";

export interface DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly causationId: string | null;

  /**
   * Envelope enrichment (ADR-008). These answer "who originated this and in which
   * tenant". They are stamped by `ApplicationService` between drain and dispatch —
   * NOT by the domain — so every aggregate and adapter is enriched uniformly without
   * the domain knowing about identity/tenancy. Optional so pre-existing inline events
   * stay valid; `BaseDomainEvent` makes them first-class for new events.
   */
  readonly companyId?: string | null;
  readonly actorId?: string | null;
  readonly actorType?: ActorType | null;
}
