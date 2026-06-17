import { Migration } from "@mikro-orm/migrations";

/**
 * Persists the reviewer's most recent rejection reason on the knowledge item so the author's
 * editor can explain why an item returned to draft (the reason was previously only emitted
 * as a domain event, which authors cannot read). Nullable: cleared on re-submit, null for
 * items never rejected.
 */
export class Migration_010_AddRejectionReasonToKnowledgeItems extends Migration {
  public override async up(): Promise<void> {
    this.addSql("ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS last_rejection_reason TEXT");
  }

  public override async down(): Promise<void> {
    this.addSql("ALTER TABLE knowledge_items DROP COLUMN IF EXISTS last_rejection_reason");
  }
}
