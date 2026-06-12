import type { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../../domain/identifiers/Identifier.ts";
import { TrackedUnitOfWork } from "../TrackedUnitOfWork.ts";

export class NoOpUnitOfWork extends TrackedUnitOfWork {
  protected async onBegin(): Promise<void> {}

  protected async onCommit(
    _trackedAggregates: ReadonlyArray<AggregateRoot<Identifier, object>>,
  ): Promise<void> {}

  protected async onRollback(): Promise<void> {}
}
