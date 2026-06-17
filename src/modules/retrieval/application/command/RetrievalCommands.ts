/**
 * Command factories for the Retrieval & Indexing context (PRD-4). Private constructors +
 * static `of()` so adapters pass primitives and never build internals directly. Indexing
 * commands carry only an item/company id — the projection use case fetches the served
 * content from the published-item reader. The search command carries the already-resolved
 * scope (PRD-5 owns credential resolution).
 */
const DEFAULT_SEARCH_LIMIT = 10;

export class ProjectItemCommand {
  private constructor(public readonly itemId: string) {}
  public static of(itemId: string): ProjectItemCommand {
    return new ProjectItemCommand(itemId);
  }
}

export class DeprecateItemIndexCommand {
  private constructor(
    public readonly companyId: string,
    public readonly itemId: string,
  ) {}
  public static of(companyId: string, itemId: string): DeprecateItemIndexCommand {
    return new DeprecateItemIndexCommand(companyId, itemId);
  }
}

export class RemoveItemFromIndexCommand {
  private constructor(
    public readonly companyId: string,
    public readonly itemId: string,
  ) {}
  public static of(companyId: string, itemId: string): RemoveItemFromIndexCommand {
    return new RemoveItemFromIndexCommand(companyId, itemId);
  }
}

export class RebuildIndexCommand {
  private constructor(public readonly companyId: string) {}
  public static of(companyId: string): RebuildIndexCommand {
    return new RebuildIndexCommand(companyId);
  }
}

export class SemanticSearchCommand {
  private constructor(
    public readonly companyId: string,
    public readonly query: string,
    public readonly collectionIds: ReadonlyArray<string> | null,
    public readonly sensitivityCeiling: string | null,
    public readonly tagIds: ReadonlyArray<string> | null,
    public readonly limit: number,
  ) {}

  public static of(
    companyId: string,
    query: string,
    collectionIds: ReadonlyArray<string> | null = null,
    sensitivityCeiling: string | null = null,
    tagIds: ReadonlyArray<string> | null = null,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): SemanticSearchCommand {
    return new SemanticSearchCommand(companyId, query, collectionIds, sensitivityCeiling, tagIds, limit);
  }
}
