import { Migration } from "@mikro-orm/migrations";

/**
 * Enriches the event store envelope (ADR-008/009): every event now records who
 * originated it and in which tenant. The composite indexes back the auditor read
 * model (events by tenant over time, and by tenant + aggregate).
 */
export class Migration_004_AddActorEnvelopeToSystemEvents extends Migration {
  public override async up(): Promise<void> {
    this.addSql("ALTER TABLE system_events ADD COLUMN company_id TEXT");
    this.addSql("ALTER TABLE system_events ADD COLUMN actor_id TEXT");
    this.addSql("ALTER TABLE system_events ADD COLUMN actor_type TEXT");

    this.addSql(
      "CREATE INDEX idx_system_events_company_occurred ON system_events (company_id, occurred_at)",
    );
    this.addSql(
      "CREATE INDEX idx_system_events_company_aggregate ON system_events (company_id, aggregate_id)",
    );
  }

  public override async down(): Promise<void> {
    this.addSql("DROP INDEX IF EXISTS idx_system_events_company_aggregate");
    this.addSql("DROP INDEX IF EXISTS idx_system_events_company_occurred");
    this.addSql("ALTER TABLE system_events DROP COLUMN actor_type");
    this.addSql("ALTER TABLE system_events DROP COLUMN actor_id");
    this.addSql("ALTER TABLE system_events DROP COLUMN company_id");
  }
}
