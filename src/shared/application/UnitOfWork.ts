import type { AggregateRoot } from "../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../domain/identifiers/Identifier.ts";
import type { DomainEventEmitter } from "../domain/events/DomainEventEmitter.ts";

export interface UnitOfWork {
  // `readOnly` lets a query open a READ ONLY transaction (ADR-004 amendment); default is
  // read-write. The ApplicationService derives it from the use case's ReadOnlyUseCase marker.
  begin(readOnly?: boolean): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getTrackedAggregates(): ReadonlyArray<AggregateRoot<Identifier, object>>;
  getTrackedEventSources(): ReadonlyArray<DomainEventEmitter>;
}
