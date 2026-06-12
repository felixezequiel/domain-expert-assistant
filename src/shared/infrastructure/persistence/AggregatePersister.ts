import type { EntityManager } from "@mikro-orm/core";
import type { AggregateRoot } from "../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../domain/identifiers/Identifier.ts";

export interface AggregatePersister {
  supports(aggregate: AggregateRoot<Identifier, object>): boolean;
  persist(
    aggregate: AggregateRoot<Identifier, object>,
    entityManager: EntityManager,
  ): Promise<void>;
  delete(aggregate: AggregateRoot<Identifier, object>, entityManager: EntityManager): Promise<void>;
}
