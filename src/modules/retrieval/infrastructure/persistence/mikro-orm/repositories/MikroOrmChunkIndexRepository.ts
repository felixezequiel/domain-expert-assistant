import { randomUUID } from "node:crypto";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type {
  ChunkIndexRepositoryPort,
  IndexableChunk,
  ChunkItemMetadata,
  RetrievalScope,
  SearchResult,
} from "../../../../application/types.ts";

/**
 * Reciprocal Rank Fusion constant (ADR-019). RRF score per result = sum over each ranked
 * list of 1/(k + rank); k≈60 dampens the contribution of low-ranked hits. No score
 * calibration — fusion is by rank, so the incomparable scales of cosine distance and
 * ts_rank never have to be normalised.
 */
const RRF_K = 60;
const CANDIDATE_MULTIPLIER = 4;
const MIN_CANDIDATES = 50;

/**
 * The raw-SQL slice of the Postgres SqlEntityManager. The base `@mikro-orm/core`
 * EntityManager type does not expose `execute`, but the SQL driver's does; this narrows to
 * exactly what the repository needs and runs within the EM's active transaction.
 */
interface RawSqlEntityManager {
  execute<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T>;
}

interface ChunkRow {
  readonly item_id: string;
  readonly title: string;
  readonly collection_id: string;
  readonly sensitivity: string;
  readonly chunk_index: number;
  readonly content: string;
  readonly score: string | number;
  readonly published_at: string;
  readonly stale: boolean;
}

/**
 * Postgres-backed derived chunk index (ADR-018/020). Writes embeddings as pgvector literals
 * and reads via a single hybrid query that fuses vector + full-text rankings with RRF in-DB
 * (ADR-019). Stages writes only — it never flushes; the UnitOfWork owns the single flush at
 * commit (ADR-004), so a projection's chunk rows commit atomically with its events. Search
 * runs outside any write transaction and uses raw SQL because the pgvector path bypasses the
 * ORM filter — tenant + scope are enforced explicitly in the WHERE (ADR-022, fail-closed).
 */
export class MikroOrmChunkIndexRepository implements ChunkIndexRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async replaceItemChunks(
    itemId: string,
    chunks: ReadonlyArray<IndexableChunk>,
    metadata: ChunkItemMetadata,
  ): Promise<void> {
    const entityManager = this.rawEntityManager();
    await entityManager.execute("DELETE FROM chunks WHERE company_id = ? AND item_id = ?", [
      metadata.companyId,
      itemId,
    ]);
    for (const chunk of chunks) {
      await entityManager.execute(
        `INSERT INTO chunks
           (id, company_id, item_id, chunk_index, title, collection_id, sensitivity,
            tag_ids, content, embedding, published_version, published_at, stale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::text[], ?, ?::vector, ?, ?, ?)`,
        [
          randomUUID(),
          metadata.companyId,
          itemId,
          chunk.chunkIndex,
          metadata.title,
          metadata.collectionId,
          metadata.sensitivity,
          MikroOrmChunkIndexRepository.toArrayLiteral(metadata.tagIds),
          chunk.content,
          MikroOrmChunkIndexRepository.toVectorLiteral(chunk.embedding),
          metadata.publishedVersion,
          metadata.publishedAt,
          metadata.stale,
        ],
      );
    }
  }

  public async removeItem(companyId: string, itemId: string): Promise<void> {
    const entityManager = this.rawEntityManager();
    await entityManager.execute("DELETE FROM chunks WHERE company_id = ? AND item_id = ?", [companyId, itemId]);
  }

  public async markItemStale(companyId: string, itemId: string): Promise<void> {
    const entityManager = this.rawEntityManager();
    await entityManager.execute("UPDATE chunks SET stale = TRUE WHERE company_id = ? AND item_id = ?", [
      companyId,
      itemId,
    ]);
  }

  public async search(
    queryEmbedding: ReadonlyArray<number>,
    queryText: string,
    scope: RetrievalScope,
    limit: number,
  ): Promise<ReadonlyArray<SearchResult>> {
    const entityManager = this.rawEntityManager();
    const candidateCount = Math.max(limit * CANDIDATE_MULTIPLIER, MIN_CANDIDATES);
    const vectorLiteral = MikroOrmChunkIndexRepository.toVectorLiteral(queryEmbedding);

    const scopeFilter = MikroOrmChunkIndexRepository.buildScopeFilter(scope);
    const rows = await entityManager.execute<Array<ChunkRow>>(
      `WITH scoped AS (
         SELECT id, item_id, title, collection_id, sensitivity, chunk_index, content,
                published_at, stale, embedding, content_tsv
           FROM chunks
          WHERE company_id = ?${scopeFilter.sql}
       ),
       vector_ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> ?::vector) AS rank
           FROM scoped
          ORDER BY embedding <=> ?::vector
          LIMIT ?
       ),
       lexical_ranked AS (
         SELECT id, ROW_NUMBER() OVER (
                  ORDER BY ts_rank(content_tsv, websearch_to_tsquery('simple', ?)) DESC
                ) AS rank
           FROM scoped
          WHERE content_tsv @@ websearch_to_tsquery('simple', ?)
          LIMIT ?
       ),
       fused AS (
         SELECT id, SUM(score) AS score FROM (
           SELECT id, 1.0 / (? + rank) AS score FROM vector_ranked
           UNION ALL
           SELECT id, 1.0 / (? + rank) AS score FROM lexical_ranked
         ) AS contributions
         GROUP BY id
       )
       SELECT s.item_id, s.title, s.collection_id, s.sensitivity, s.chunk_index, s.content,
              s.published_at, s.stale, f.score
         FROM fused f
         JOIN scoped s ON s.id = f.id
        ORDER BY f.score DESC
        LIMIT ?`,
      [
        scope.companyId,
        ...scopeFilter.params,
        vectorLiteral,
        vectorLiteral,
        candidateCount,
        queryText,
        queryText,
        candidateCount,
        RRF_K,
        RRF_K,
        limit,
      ],
    );

    return rows.map((row) => ({
      itemId: row.item_id,
      title: row.title,
      collectionId: row.collection_id,
      sensitivity: row.sensitivity,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: Number(row.score),
      publishedAt: row.published_at,
      stale: row.stale,
    }));
  }

  /**
   * Builds the per-credential scope pre-filter (ADR-022): collections the credential allows
   * and the sensitivity ceiling. The tenant floor (company_id) is always applied separately.
   * Returns SQL appended to the WHERE plus its ordered params.
   */
  private static buildScopeFilter(scope: RetrievalScope): { sql: string; params: Array<unknown> } {
    const clauses: Array<string> = [];
    const params: Array<unknown> = [];
    if (scope.collectionIds !== null) {
      if (scope.collectionIds.length === 0) {
        return { sql: " AND FALSE", params: [] };
      }
      const placeholders = scope.collectionIds.map(() => "?").join(", ");
      clauses.push(` AND collection_id IN (${placeholders})`);
      for (const collectionId of scope.collectionIds) {
        params.push(collectionId);
      }
    }
    if (scope.sensitivityCeiling !== null) {
      // Ordered low → high; a chunk passes when its level's position is at or below the
      // ceiling's. The domain has exactly these three levels (public < internal <
      // confidential), so the array mirrors the SensitivityLevel enum — no phantom entries.
      clauses.push(
        " AND array_position(ARRAY['public','internal','confidential'], sensitivity)" +
          " <= array_position(ARRAY['public','internal','confidential'], ?)",
      );
      params.push(scope.sensitivityCeiling);
    }
    if (scope.tagIds !== null) {
      if (scope.tagIds.length === 0) {
        return { sql: " AND FALSE", params: [] };
      }
      // Array overlap: the chunk's item must carry at least one of the requested tags.
      clauses.push(" AND tag_ids && ?::text[]");
      params.push(MikroOrmChunkIndexRepository.toArrayLiteral(scope.tagIds));
    }
    return { sql: clauses.join(""), params };
  }

  /**
   * Renders a Postgres `text[]` literal (e.g. `{a,b}`) for a parameterised `?::text[]`. Each
   * element is double-quoted with backslashes/quotes escaped so tag ids with commas, braces or
   * quotes can never break out of the array literal.
   */
  private static toArrayLiteral(values: ReadonlyArray<string>): string {
    const escaped = values.map((value) => {
      const safe = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${safe}"`;
    });
    return `{${escaped.join(",")}}`;
  }

  private static toVectorLiteral(vector: ReadonlyArray<number>): string {
    return "[" + vector.join(",") + "]";
  }

  private rawEntityManager(): RawSqlEntityManager {
    return this.entityManagerProvider.getEntityManager() as unknown as RawSqlEntityManager;
  }
}
