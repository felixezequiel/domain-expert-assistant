import { AggregateRoot } from "../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../domain/identifiers/Identifier.ts";
import type { DomainEventEmitter } from "../../domain/events/DomainEventEmitter.ts";
import type { UnitOfWork } from "../../application/UnitOfWork.ts";
import { AggregateTracker } from "./AggregateTracker.ts";

export abstract class TrackedUnitOfWork implements UnitOfWork {
  public async begin(): Promise<void> {
    AggregateTracker.begin();
    await this.onBegin();
  }

  public async commit(): Promise<void> {
    const allSources = AggregateTracker.drain();

    const trackedAggregates: Array<AggregateRoot<Identifier, object>> = [];
    for (const source of allSources) {
      if (source instanceof AggregateRoot) {
        trackedAggregates.push(source);
      }
    }

    await this.onCommit(trackedAggregates);
  }

  public async rollback(): Promise<void> {
    AggregateTracker.clear();
    await this.onRollback();
  }

  public getTrackedAggregates(): ReadonlyArray<AggregateRoot<Identifier, object>> {
    const allSources = AggregateTracker.peek();

    const aggregates: Array<AggregateRoot<Identifier, object>> = [];
    for (const source of allSources) {
      if (source instanceof AggregateRoot) {
        aggregates.push(source);
      }
    }

    return aggregates;
  }

  public getTrackedEventSources(): ReadonlyArray<DomainEventEmitter> {
    return AggregateTracker.peek();
  }

  protected abstract onBegin(): Promise<void>;

  protected abstract onCommit(
    trackedAggregates: ReadonlyArray<AggregateRoot<Identifier, object>>,
  ): Promise<void>;

  protected abstract onRollback(): Promise<void>;
}
