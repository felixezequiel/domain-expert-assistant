import type { Identifier } from "../domain/identifiers/Identifier.ts";

export interface RepositoryPort<Id extends Identifier, Aggregate> {
  save(aggregate: Aggregate): Promise<void>;
  findById(id: Id): Promise<Aggregate | null>;
  delete(id: Id): Promise<void>;
}
