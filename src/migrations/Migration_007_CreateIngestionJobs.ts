import { Migration } from "@mikro-orm/migrations";

/**
 * The `ingestion_jobs` table doubles as the async work queue (ADR-015): the worker drains
 * by `status`, so it carries a status index plus the usual tenant `(company_id, status)`.
 */
export class Migration_007_CreateIngestionJobs extends Migration {
  public override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS ingestion_jobs (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        storage_ref TEXT NOT NULL,
        status TEXT NOT NULL,
        created_item_id TEXT,
        failure_reason TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.addSql("CREATE INDEX idx_ingestion_jobs_company_status ON ingestion_jobs (company_id, status)");
    this.addSql("CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs (status)");
  }

  public override async down(): Promise<void> {
    this.addSql("DROP TABLE IF EXISTS ingestion_jobs");
  }
}
