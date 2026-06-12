import { Migration } from "@mikro-orm/migrations";

export class Migration_001_CreateUsersAndAddresses extends Migration {
  public override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE
      )
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS addresses (
        id TEXT PRIMARY KEY,
        street TEXT NOT NULL,
        number TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        user_id TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  public override async down(): Promise<void> {
    this.addSql("DROP TABLE IF EXISTS addresses");
    this.addSql("DROP TABLE IF EXISTS users");
  }
}
