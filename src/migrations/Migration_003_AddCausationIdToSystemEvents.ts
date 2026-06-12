import { Migration } from "@mikro-orm/migrations";

export class Migration_003_AddCausationIdToSystemEvents extends Migration {
  public override async up(): Promise<void> {
    this.addSql("ALTER TABLE system_events ADD COLUMN causation_id TEXT");
  }

  public override async down(): Promise<void> {
    this.addSql("ALTER TABLE system_events DROP COLUMN causation_id");
  }
}
