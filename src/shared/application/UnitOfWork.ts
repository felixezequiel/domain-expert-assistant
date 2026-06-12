import type { AggregateRoot } from "../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../domain/identifiers/Identifier.ts";
import type { DomainEventEmitter } from "../domain/events/DomainEventEmitter.ts";

export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getTrackedAggregates(): ReadonlyArray<AggregateRoot<Identifier, object>>;
  getTrackedEventSources(): ReadonlyArray<DomainEventEmitter>;
}
