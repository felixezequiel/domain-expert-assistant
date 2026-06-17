import { Migration } from "@mikro-orm/migrations";

/**
 * Carries the published item's tag ids on every chunk row so the consumption `tags` search
 * filter can pre-filter in-DB (PRD-4/PRD-5) instead of being a no-op — the index previously
 * stored no tags, so a tag-narrowed search silently ignored them. Stored as `text[]` with a
 * default of the empty array so existing rows (and any chunk for an untagged item) are valid
 * without backfill; a GIN index supports the `&&` array-overlap predicate the search uses.
 */
export class Migration_011_AddTagIdsToChunks extends Migration {
  public override async up(): Promise<void> {
    this.addSql("ALTER TABLE chunks ADD COLUMN IF NOT EXISTS tag_ids TEXT[] NOT NULL DEFAULT '{}'");
    this.addSql("CREATE INDEX IF NOT EXISTS idx_chunks_tag_ids ON chunks USING GIN (tag_ids)");
  }

  public override async down(): Promise<void> {
    this.addSql("DROP INDEX IF EXISTS idx_chunks_tag_ids");
    this.addSql("ALTER TABLE chunks DROP COLUMN IF EXISTS tag_ids");
  }
}
