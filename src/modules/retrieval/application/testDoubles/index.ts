import { createHash } from "node:crypto";
import type {
  EmbedderPort,
  ChunkIndexRepositoryPort,
  IndexableChunk,
  ChunkItemMetadata,
  RetrievalScope,
  SearchResult,
  PublishedItemReaderPort,
  PublishedItem,
} from "../types.ts";

const FAKE_DIMENSIONS = 1024;

/**
 * Deterministic embedder for tests — no model, no network (PRD-4 acceptance: embedding runs
 * offline). It hashes each text into a fixed 1024-dim unit vector: the same text always maps
 * to the same vector, and different texts map to different vectors, which is all the index/
 * search tests need. It is NOT semantically meaningful — relevance quality is the real
 * model's job, validated in the integration check.
 */
export class FakeEmbedder implements EmbedderPort {
  public readonly dimensions = FAKE_DIMENSIONS;

  public async embed(texts: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<number>>> {
    return texts.map((text) => FakeEmbedder.vectorFor(text));
  }

  private static vectorFor(text: string): ReadonlyArray<number> {
    const vector = new Array<number>(FAKE_DIMENSIONS).fill(0);
    let magnitude = 0;
    for (let dimension = 0; dimension < FAKE_DIMENSIONS; dimension += 1) {
      const digest = createHash("sha256").update(text + ":" + String(dimension)).digest();
      const value = (digest.readUInt32BE(0) / 0xffffffff) * 2 - 1;
      vector[dimension] = value;
      magnitude += value * value;
    }
    const norm = Math.sqrt(magnitude) || 1;
    for (let dimension = 0; dimension < FAKE_DIMENSIONS; dimension += 1) {
      vector[dimension] = vector[dimension]! / norm;
    }
    return vector;
  }
}

interface StoredChunk {
  readonly itemId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly embedding: ReadonlyArray<number>;
  readonly metadata: ChunkItemMetadata;
}

/**
 * In-memory chunk index for application tests. `replaceItemChunks` is delete-then-insert
 * (idempotent reprojection). `search` does a simple lexical-overlap rank pre-filtered by the
 * scope (tenant + collections + sensitivity ceiling), enough to assert wiring, filtering and
 * fail-closed behaviour without a database. The real RRF lives in the Postgres adapter.
 */
export class FakeChunkIndexRepository implements ChunkIndexRepositoryPort {
  private readonly chunks: Array<StoredChunk> = [];
  private static readonly SENSITIVITY_ORDER = ["public", "internal", "confidential", "restricted"];

  public async replaceItemChunks(
    itemId: string,
    chunks: ReadonlyArray<IndexableChunk>,
    metadata: ChunkItemMetadata,
  ): Promise<void> {
    this.removeAll(itemId);
    for (const chunk of chunks) {
      this.chunks.push({
        itemId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        metadata,
      });
    }
  }

  public async removeItem(companyId: string, itemId: string): Promise<void> {
    for (let position = this.chunks.length - 1; position >= 0; position -= 1) {
      const stored = this.chunks[position]!;
      if (stored.itemId === itemId && stored.metadata.companyId === companyId) {
        this.chunks.splice(position, 1);
      }
    }
  }

  public async markItemStale(companyId: string, itemId: string): Promise<void> {
    for (let position = 0; position < this.chunks.length; position += 1) {
      const stored = this.chunks[position]!;
      if (stored.itemId === itemId && stored.metadata.companyId === companyId) {
        this.chunks[position] = { ...stored, metadata: { ...stored.metadata, stale: true } };
      }
    }
  }

  public async search(
    _queryEmbedding: ReadonlyArray<number>,
    queryText: string,
    scope: RetrievalScope,
    limit: number,
  ): Promise<ReadonlyArray<SearchResult>> {
    const queryTerms = queryText.toLowerCase().split(/\s+/).filter((term) => term.length > 0);
    if (queryTerms.length === 0) {
      return [];
    }
    const scored: Array<SearchResult & { readonly overlap: number }> = [];
    for (const stored of this.chunks) {
      if (!this.passesScope(stored, scope)) {
        continue;
      }
      const haystack = stored.content.toLowerCase();
      let overlap = 0;
      for (const term of queryTerms) {
        if (haystack.includes(term)) {
          overlap += 1;
        }
      }
      if (overlap === 0) {
        continue;
      }
      scored.push({
        itemId: stored.itemId,
        title: stored.metadata.title,
        collectionId: stored.metadata.collectionId,
        sensitivity: stored.metadata.sensitivity,
        chunkIndex: stored.chunkIndex,
        content: stored.content,
        score: overlap / queryTerms.length,
        publishedAt: stored.metadata.publishedAt,
        stale: stored.metadata.stale,
        overlap,
      });
    }
    scored.sort((left, right) => right.overlap - left.overlap);
    return scored.slice(0, limit).map(({ overlap: _overlap, ...result }) => result);
  }

  private passesScope(stored: StoredChunk, scope: RetrievalScope): boolean {
    if (stored.metadata.companyId !== scope.companyId) {
      return false;
    }
    if (scope.collectionIds !== null && !scope.collectionIds.includes(stored.metadata.collectionId)) {
      return false;
    }
    if (scope.sensitivityCeiling !== null) {
      const ceiling = FakeChunkIndexRepository.SENSITIVITY_ORDER.indexOf(scope.sensitivityCeiling);
      const level = FakeChunkIndexRepository.SENSITIVITY_ORDER.indexOf(stored.metadata.sensitivity);
      if (level > ceiling) {
        return false;
      }
    }
    return true;
  }

  private removeAll(itemId: string): void {
    for (let position = this.chunks.length - 1; position >= 0; position -= 1) {
      if (this.chunks[position]!.itemId === itemId) {
        this.chunks.splice(position, 1);
      }
    }
  }
}

/** In-memory published-item reader for tests. */
export class FakePublishedItemReader implements PublishedItemReaderPort {
  private readonly items = new Map<string, PublishedItem>();

  public add(item: PublishedItem): void {
    this.items.set(item.itemId, item);
  }

  public remove(itemId: string): void {
    this.items.delete(itemId);
  }

  public async getPublishedItem(itemId: string): Promise<PublishedItem | null> {
    return this.items.get(itemId) ?? null;
  }

  public async listServedItems(companyId: string): Promise<ReadonlyArray<PublishedItem>> {
    const result: Array<PublishedItem> = [];
    for (const item of this.items.values()) {
      if (item.companyId === companyId) {
        result.push(item);
      }
    }
    return result;
  }
}
