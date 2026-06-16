import { Migration } from "@mikro-orm/migrations";

/**
 * Knowledge core tables (PRD-2). `collections`, `tags`, `knowledge_items` and the
 * append-only `knowledge_versions` are tenant-scoped (the app-layer CompanyFilter enforces
 * isolation; RLS is the tracked follow-up). `tags` is the shared-reference table (ADR-014):
 * system tags carry `company_id = null` and `scope = 'system'`, visible to every tenant via
 * the company-or-system filter, and are seeded here as immutable product vocabulary.
 */
export class Migration_006_CreateKnowledgeTables extends Migration {
  public override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL
      )
    `);
    this.addSql("CREATE INDEX idx_collections_company ON collections (company_id)");

    this.addSql(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        slug TEXT NOT NULL,
        label TEXT NOT NULL,
        scope TEXT NOT NULL
      )
    `);
    this.addSql("CREATE UNIQUE INDEX uq_tags_company_slug ON tags (company_id, slug)");

    this.addSql(`
      CREATE TABLE IF NOT EXISTS knowledge_items (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tag_ids TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version_number INTEGER NOT NULL,
        published_version_number INTEGER,
        author_id TEXT NOT NULL,
        last_editor_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.addSql(
      "CREATE INDEX idx_knowledge_items_company_collection_status ON knowledge_items (company_id, collection_id, status)",
    );
    this.addSql(
      "CREATE INDEX idx_knowledge_items_company_status ON knowledge_items (company_id, status)",
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS knowledge_versions (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tag_ids TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.addSql(
      "CREATE INDEX idx_knowledge_versions_item_version ON knowledge_versions (item_id, version_number)",
    );

    this.addSql(`
      INSERT INTO tags (id, company_id, slug, label, scope) VALUES
        ('system-tag-glossario', NULL, 'glossario', 'Glossario', 'system'),
        ('system-tag-regra', NULL, 'regra', 'Regra', 'system'),
        ('system-tag-processo', NULL, 'processo', 'Processo', 'system'),
        ('system-tag-faq', NULL, 'faq', 'Faq', 'system'),
        ('system-tag-documento', NULL, 'documento', 'Documento', 'system')
      ON CONFLICT DO NOTHING
    `);
  }

  public override async down(): Promise<void> {
    this.addSql("DROP TABLE IF EXISTS knowledge_versions");
    this.addSql("DROP TABLE IF EXISTS knowledge_items");
    this.addSql("DROP TABLE IF EXISTS tags");
    this.addSql("DROP TABLE IF EXISTS collections");
  }
}
