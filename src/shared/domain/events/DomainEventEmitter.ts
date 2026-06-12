import type { DomainEvent } from "./DomainEvent.ts";

export interface DomainEventEmitter {
  getDomainEvents(): ReadonlyArray<DomainEvent>;
  drainDomainEvents(): ReadonlyArray<DomainEvent>;
}
