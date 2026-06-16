import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { QueryExecutor } from "../service/KnowledgeQueryFacade.ts";
import type {
  KnowledgeItemView,
  KnowledgeItemFilter,
  CollectionView,
  TagView,
} from "../../../knowledge/application/types.ts";
import type { SearchResult } from "../../../retrieval/application/types.ts";
import type { SemanticSearchCommand } from "../../../retrieval/application/command/RetrievalCommands.ts";

/**
 * In-memory doubles for Consumption facade unit tests (hexagonal rule: application tests
 * depend on ports/use cases, never infrastructure). Production runs the same use case
 * instances through the real `ApplicationService`.
 */

/**
 * A `QueryExecutor` that simply calls the use case directly (no unit of work, no actor
 * scope). The facade only orchestrates and applies scope; the real tenant filter lives in
 * the production `ApplicationService`, exercised by the integration test, not here.
 */
export class DirectQueryExecutor implements QueryExecutor {
  public execute<Command, Result>(useCase: UseCase<Command, Result>, command: Command): Promise<Result> {
    return useCase.execute(command);
  }
}

/** Records the last search command it received, returns a fixed result set. */
export class StubSemanticSearch implements UseCase<SemanticSearchCommand, ReadonlyArray<SearchResult>> {
  public lastCommand: SemanticSearchCommand | null = null;
  constructor(private readonly results: ReadonlyArray<SearchResult>) {}
  public async execute(command: SemanticSearchCommand): Promise<ReadonlyArray<SearchResult>> {
    this.lastCommand = command;
    return this.results;
  }
}

export class StubGetItem implements UseCase<string, KnowledgeItemView | null> {
  constructor(private readonly itemsById: ReadonlyMap<string, KnowledgeItemView>) {}
  public async execute(itemId: string): Promise<KnowledgeItemView | null> {
    return this.itemsById.get(itemId) ?? null;
  }
}

export class StubListItems implements UseCase<KnowledgeItemFilter, ReadonlyArray<KnowledgeItemView>> {
  public lastFilter: KnowledgeItemFilter | null = null;
  constructor(private readonly items: ReadonlyArray<KnowledgeItemView>) {}
  public async execute(filter: KnowledgeItemFilter): Promise<ReadonlyArray<KnowledgeItemView>> {
    this.lastFilter = filter;
    const result: Array<KnowledgeItemView> = [];
    for (const item of this.items) {
      if (filter.collectionId !== null && item.collectionId !== filter.collectionId) {
        continue;
      }
      if (filter.status !== null && item.status !== filter.status) {
        continue;
      }
      result.push(item);
    }
    return result;
  }
}

export class StubListCollections implements UseCase<void, ReadonlyArray<CollectionView>> {
  constructor(private readonly collections: ReadonlyArray<CollectionView>) {}
  public async execute(): Promise<ReadonlyArray<CollectionView>> {
    return this.collections;
  }
}

export class StubListTags implements UseCase<void, ReadonlyArray<TagView>> {
  constructor(private readonly tags: ReadonlyArray<TagView>) {}
  public async execute(): Promise<ReadonlyArray<TagView>> {
    return this.tags;
  }
}
