import { Migration } from "@mikro-orm/migrations";

export class Migration_002_CreateSystemEvents extends Migration {
  public override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS system_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload TEXT NOT NULL
      )
    `);
  }

  public override async down(): Promise<void> {
    this.addSql("DROP TABLE IF EXISTS system_events");
  }
}
