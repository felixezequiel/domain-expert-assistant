import { Migration } from "@mikro-orm/migrations";

/**
 * The derived vector index (ADR-018/020). `chunks` is a read-model rebuildable from the
 * published knowledge items — never a source of truth — so it stores everything a hybrid
 * search needs in one row: the chunk text, its `embedding vector(1024)` (BGE-M3, ADR-017),
 * and the served metadata used to pre-filter by scope without leaking (ADR-022): company,
 * collection, sensitivity, plus a `stale` flag for deprecated items.
 *
 * Indexes: HNSW (cosine) on the embedding for ANN; a GIN index on a generated `content_tsv`
 * for Postgres full-text; and `(company_id, item_id)` for the tenant filter + the
 * delete-then-insert reprojection. Hybrid search fuses the vector + full-text rankings via
 * RRF in one query (ADR-019).
 */
export class Migration_008_CreateChunkIndex extends Migration {
  public override async up(): Promise<void> {
    this.addSql("CREATE EXTENSION IF NOT EXISTS vector");

    this.addSql(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        content TEXT NOT NULL,
        content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
        embedding vector(1024) NOT NULL,
        published_version INTEGER NOT NULL,
        published_at TEXT NOT NULL,
        stale BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);

    this.addSql("CREATE INDEX idx_chunks_company_item ON chunks (company_id, item_id)");
    this.addSql("CREATE INDEX idx_chunks_content_tsv ON chunks USING GIN (content_tsv)");
    this.addSql(
      "CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops)",
    );
  }

  public override async down(): Promise<void> {
    this.addSql("DROP TABLE IF EXISTS chunks");
  }
}
