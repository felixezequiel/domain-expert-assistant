import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { EmbedderPort, ChunkIndexRepositoryPort, SearchResult, RetrievalScope } from "../types.ts";
import type { SemanticSearchCommand } from "../command/RetrievalCommands.ts";

/**
 * Hybrid semantic search (PRD-4, ADR-019). Embeds the query locally, then asks the index for
 * the RRF fusion of vector + full-text candidates, pre-filtered by tenant + scope (ADR-022:
 * fail-closed — an empty query or a scope that matches nothing returns nothing, never a leak).
 * Reranking is OFF in v1 (RerankerPort defined but unwired). Every result carries attribution
 * (item title) + freshness (publishedAt, stale) so the consuming AI can weigh relevance.
 */
export class SemanticSearchUseCase implements UseCase<SemanticSearchCommand, ReadonlyArray<SearchResult>> {
  private readonly embedder: EmbedderPort;
  private readonly chunkIndex: ChunkIndexRepositoryPort;

  constructor(embedder: EmbedderPort, chunkIndex: ChunkIndexRepositoryPort) {
    this.embedder = embedder;
    this.chunkIndex = chunkIndex;
  }

  public async execute(command: SemanticSearchCommand): Promise<ReadonlyArray<SearchResult>> {
    const query = command.query.trim();
    if (query.length === 0) {
      return [];
    }
    const scope: RetrievalScope = {
      companyId: command.companyId,
      collectionIds: command.collectionIds,
      sensitivityCeiling: command.sensitivityCeiling,
    };
    const [queryEmbedding] = await this.embedder.embed([query]);
    // Deprecated items stay in the served index flagged `stale` (ADR-020) so a consumer can
    // still find them and decide; the curation Catalog mirrors this by listing deprecated
    // items with a "Deprecated" badge rather than hiding them (finding S3 resolved UI-side).
    return this.chunkIndex.search(queryEmbedding!, query, scope, command.limit);
  }
}
