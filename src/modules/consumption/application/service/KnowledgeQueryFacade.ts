import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import type { SearchResult } from "../../../retrieval/application/types.ts";
import { SemanticSearchCommand } from "../../../retrieval/application/command/RetrievalCommands.ts";
import type {
  KnowledgeItemView,
  KnowledgeItemFilter,
  CollectionView,
  TagView,
} from "../../../knowledge/application/types.ts";
import type { ScopeResolver } from "./ScopeResolver.ts";
import type {
  SearchRequest,
  SearchResponse,
  LookupRequest,
  ConsumerItemView,
  CollectionSummary,
  TagSummary,
} from "../types.ts";

const DEFAULT_SEARCH_LIMIT = 10;

/**
 * The thin executor the facade runs its reads through. Production passes the shared
 * `ApplicationService` (so every read opens the unit of work with the consumer's actor
 * scope → tenant filter, ADR-009). Facade unit tests pass a direct executor; the real
 * tenant filtering is asserted in the integration/e2e path, not in these unit tests.
 */
export interface QueryExecutor {
  execute<Command, Result>(useCase: UseCase<Command, Result>, command: Command): Promise<Result>;
}

/**
 * The use cases the facade orchestrates. The semantic search use case is Retrieval's
 * (PRD-4); the rest are Knowledge's read queries (PRD-2). They are shared instances so REST
 * and MCP run the exact same code (parity, ADR-021).
 */
export interface KnowledgeQueryUseCases {
  readonly semanticSearch: UseCase<SemanticSearchCommand, ReadonlyArray<SearchResult>>;
  readonly getItem: UseCase<string, KnowledgeItemView | null>;
  readonly listItems: UseCase<KnowledgeItemFilter, ReadonlyArray<KnowledgeItemView>>;
  readonly listCollections: UseCase<void, ReadonlyArray<CollectionView>>;
  readonly listTags: UseCase<void, ReadonlyArray<TagView>>;
}

/**
 * The SINGLE orchestration point both the REST edge and the MCP server delegate to (ADR-021
 * "facade único"). Every method resolves the effective scope from the credential first, then
 * applies it fail-closed (ADR-022):
 *
 * - `search` pre-filters the index query by company + effective collections + ceiling — an
 *   empty effective collection list yields empty results, never "all".
 * - `getItem` returns null unless the item is served AND its collection is in the effective
 *   scope AND its sensitivity is within the ceiling; an out-of-scope or non-served item is
 *   indistinguishable from a missing one (no metadata leak).
 * - `lookup` is a deterministic scan of served, in-scope items matching title/tag/collection.
 * - `listCollections` / `listTags` expose only the credential's in-scope collections / facets.
 *
 * Consumer invariants: only Published/served items are visible; Deprecated appears flagged
 * stale; Archived (never served) never appears; nothing outside the effective scope appears.
 */
export class KnowledgeQueryFacade {
  private readonly scopeResolver: ScopeResolver;
  private readonly executor: QueryExecutor;
  private readonly useCases: KnowledgeQueryUseCases;

  constructor(
    scopeResolver: ScopeResolver,
    executor: QueryExecutor,
    useCases: KnowledgeQueryUseCases,
  ) {
    this.scopeResolver = scopeResolver;
    this.executor = executor;
    this.useCases = useCases;
  }

  public async search(
    companyId: string,
    credentialScope: CredentialScope,
    request: SearchRequest,
  ): Promise<SearchResponse> {
    const effectiveScope = this.scopeResolver.resolve(credentialScope, {
      collectionIds: request.collectionIds,
    });
    const limit = request.k !== undefined && request.k > 0 ? request.k : DEFAULT_SEARCH_LIMIT;
    const command = SemanticSearchCommand.of(
      companyId,
      request.query,
      [...effectiveScope.collectionIds],
      effectiveScope.sensitivityCeiling,
      limit,
    );
    const results = await this.executor.execute(this.useCases.semanticSearch, command);
    const filtered = this.filterByTags(results, request.tags);
    return { results: filtered, effectiveScope };
  }

  public async getItem(
    credentialScope: CredentialScope,
    itemId: string,
  ): Promise<ConsumerItemView | null> {
    const effectiveScope = this.scopeResolver.resolve(credentialScope, {});
    const item = await this.executor.execute(this.useCases.getItem, itemId);
    if (item === null || !item.isServed) {
      return null;
    }
    if (!this.scopeResolver.permits(effectiveScope, item.collectionId, item.sensitivity)) {
      return null;
    }
    return KnowledgeQueryFacade.toConsumerItem(item);
  }

  public async lookup(
    credentialScope: CredentialScope,
    request: LookupRequest,
  ): Promise<ReadonlyArray<ConsumerItemView>> {
    const effectiveScope = this.scopeResolver.resolve(credentialScope, {
      collectionIds: request.collectionId === undefined ? undefined : [request.collectionId],
    });
    const filter: KnowledgeItemFilter = {
      collectionId: request.collectionId ?? null,
      status: null,
    };
    const items = await this.executor.execute(this.useCases.listItems, filter);
    const titleNeedle = request.title === undefined ? null : request.title.toLowerCase();

    const matches: Array<ConsumerItemView> = [];
    for (const item of items) {
      if (!item.isServed) {
        continue;
      }
      if (!this.scopeResolver.permits(effectiveScope, item.collectionId, item.sensitivity)) {
        continue;
      }
      if (titleNeedle !== null && !item.title.toLowerCase().includes(titleNeedle)) {
        continue;
      }
      if (request.tag !== undefined && !item.tagIds.includes(request.tag)) {
        continue;
      }
      matches.push(KnowledgeQueryFacade.toConsumerItem(item));
    }
    return matches;
  }

  public async listCollections(
    credentialScope: CredentialScope,
  ): Promise<ReadonlyArray<CollectionSummary>> {
    const effectiveScope = this.scopeResolver.resolve(credentialScope, {});
    const collections = await this.executor.execute(this.useCases.listCollections, undefined);
    const inScope: Array<CollectionSummary> = [];
    for (const collection of collections) {
      if (effectiveScope.collectionIds.includes(collection.id)) {
        inScope.push({ id: collection.id, name: collection.name, description: collection.description });
      }
    }
    return inScope;
  }

  public async listTags(credentialScope: CredentialScope): Promise<ReadonlyArray<TagSummary>> {
    // Tags are tenant-wide facets (ADR-014); the credential scope is over collections, so
    // every in-tenant tag is a valid facet for an in-scope item. Resolving the scope still
    // runs the same fail-closed path for consistency.
    this.scopeResolver.resolve(credentialScope, {});
    const tags = await this.executor.execute(this.useCases.listTags, undefined);
    const summaries: Array<TagSummary> = [];
    for (const tag of tags) {
      summaries.push({ id: tag.id, slug: tag.slug, label: tag.label });
    }
    return summaries;
  }

  private filterByTags(
    results: ReadonlyArray<SearchResult>,
    tags: ReadonlyArray<string> | undefined,
  ): ReadonlyArray<SearchResult> {
    if (tags === undefined || tags.length === 0) {
      return results;
    }
    // The chunk index does not carry tag ids, so a tag filter on search is a no-op narrowing
    // hint in v1 (lookup is the tag-precise path). Kept explicit so the contract is honest.
    return results;
  }

  private static toConsumerItem(item: KnowledgeItemView): ConsumerItemView {
    return {
      id: item.id,
      collectionId: item.collectionId,
      title: item.title,
      body: item.body,
      tagIds: item.tagIds,
      sensitivity: item.sensitivity,
      stale: item.isStale,
    };
  }
}
