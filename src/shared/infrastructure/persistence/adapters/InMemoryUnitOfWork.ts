import type { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../../domain/identifiers/Identifier.ts";
import { TrackedUnitOfWork } from "../TrackedUnitOfWork.ts";

export interface InMemoryRepositoryAdapter {
  supports(aggregate: AggregateRoot<Identifier, object>): boolean;
  save(aggregate: AggregateRoot<Identifier, object>): Promise<void>;
  delete?(id: Identifier): Promise<void>;
}

export class InMemoryUnitOfWork extends TrackedUnitOfWork {
  private readonly repositoryAdapters: ReadonlyArray<InMemoryRepositoryAdapter>;

  constructor(repositoryAdapters: ReadonlyArray<InMemoryRepositoryAdapter>) {
    super();
    this.repositoryAdapters = repositoryAdapters;
  }

  protected async onBegin(): Promise<void> {
    // no-op for in-memory
  }

  protected async onCommit(
    trackedAggregates: ReadonlyArray<AggregateRoot<Identifier, object>>,
  ): Promise<void> {
    for (const aggregate of trackedAggregates) {
      for (const adapter of this.repositoryAdapters) {
        if (adapter.supports(aggregate)) {
          if (aggregate.isMarkedForDeletion()) {
            await adapter.delete?.(aggregate.id);
          } else {
            await adapter.save(aggregate);
          }
          break;
        }
      }
    }
  }

  protected async onRollback(): Promise<void> {
    // no-op for in-memory
  }
}
