/**
 * Secondary ports for the Retrieval & Indexing context (PRD-4). This context is mostly a
 * derived read-side (CQRS): the vector index is a read-model rebuildable from published
 * items (ADR-020), so its repository stages writes through the UnitOfWork and never flushes
 * itself (ADR-004). Embedding runs locally and free (ADR-017); hybrid search fuses pgvector
 * + Postgres full-text in-DB (ADR-019); every search is fail-closed, filtered by companyId +
 * RetrievalScope (ADR-022) — no scope means no results.
 */

/**
 * Generates embeddings for texts via a local model (ADR-017: BGE-M3, 1024-dim, no query
 * prefix). `dimensions` is the fixed vector width the pgvector column is sized for.
 */
export interface EmbedderPort {
  readonly dimensions: number;
  embed(texts: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<number>>>;
}

/**
 * One chunk of an item ready to be indexed: its ordinal within the item, the chunk text,
 * and its embedding vector. The index row also carries the item's served metadata for
 * scope filtering (companyId, collectionId, sensitivity, stale flag).
 */
export interface IndexableChunk {
  readonly chunkIndex: number;
  readonly content: string;
  readonly embedding: ReadonlyArray<number>;
}

/**
 * Metadata stamped on every chunk row so search can pre-filter by scope without leaking
 * (ADR-022). `stale` marks a deprecated item that stays searchable but flagged outdated.
 */
export interface ChunkItemMetadata {
  readonly companyId: string;
  readonly collectionId: string;
  readonly sensitivity: string;
  readonly title: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly publishedVersion: number;
  readonly publishedAt: string;
  readonly stale: boolean;
}

/**
 * The effective search scope, already resolved by the caller (PRD-5 owns credential
 * resolution; here it arrives pre-resolved). Empty/absent collection list and ceiling are
 * a caller decision — the index repository applies whatever it is given as a pre-filter.
 */
export interface RetrievalScope {
  readonly companyId: string;
  readonly collectionIds: ReadonlyArray<string> | null;
  readonly sensitivityCeiling: string | null;
  // When non-null, restricts results to chunks whose item carries at least one of these tags.
  // Null/absent means no tag narrowing (the common case).
  readonly tagIds: ReadonlyArray<string> | null;
}

export interface SearchResult {
  readonly itemId: string;
  readonly title: string;
  readonly collectionId: string;
  readonly sensitivity: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly score: number;
  readonly publishedAt: string;
  readonly stale: boolean;
}

/**
 * The derived vector index (ADR-018/020). `replaceItemChunks` is delete-then-insert so
 * reprojecting an item is idempotent. `search` fuses vector + full-text via RRF in-DB,
 * pre-filtered by tenant + scope (ADR-019/022). `markItemStale` flips the stale flag when
 * an item is deprecated (kept indexed, flagged). `removeItem` clears an archived item.
 */
export interface ChunkIndexRepositoryPort {
  replaceItemChunks(
    itemId: string,
    chunks: ReadonlyArray<IndexableChunk>,
    metadata: ChunkItemMetadata,
  ): Promise<void>;
  removeItem(companyId: string, itemId: string): Promise<void>;
  markItemStale(companyId: string, itemId: string): Promise<void>;
  search(
    queryEmbedding: ReadonlyArray<number>,
    queryText: string,
    scope: RetrievalScope,
    limit: number,
  ): Promise<ReadonlyArray<SearchResult>>;
}

/**
 * Cross-context read port: lets the projection worker fetch a published item's served
 * content without importing the Knowledge aggregates. Knowledge/composition provides the
 * adapter. Returns null when the item is not (or no longer) served.
 */
export interface PublishedItem {
  readonly itemId: string;
  readonly companyId: string;
  readonly collectionId: string;
  readonly title: string;
  readonly body: string;
  readonly sensitivity: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly publishedVersion: number;
  readonly publishedAt: string;
  readonly stale: boolean;
}

export interface PublishedItemReaderPort {
  getPublishedItem(itemId: string): Promise<PublishedItem | null>;
  listServedItems(companyId: string): Promise<ReadonlyArray<PublishedItem>>;
}

/**
 * Reranking abstraction (ADR-019). Defined for forward-compatibility but OFF in v1: the
 * consumer is an LLM reading the top-K, the corpus is curated and small, and results carry
 * freshness/attribution — so RRF recall is enough. Wired only when a golden-set proves the
 * hybrid precision insufficient.
 */
export interface RerankerPort {
  rerank(query: string, results: ReadonlyArray<SearchResult>): Promise<ReadonlyArray<SearchResult>>;
}
