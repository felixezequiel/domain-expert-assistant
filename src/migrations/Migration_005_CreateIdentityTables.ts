import { Migration } from "@mikro-orm/migrations";

/**
 * Identity & Access tables (PRD-1). `organizations` is the tenant root (not
 * company-filtered); users, consumer_credentials and sessions are tenant-scoped and carry
 * company_id (the app-layer CompanyFilter enforces isolation; RLS is the tracked follow-up).
 */
export class Migration_005_CreateIdentityTables extends Migration {
  public override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        require_separate_reviewer BOOLEAN NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT,
        roles TEXT NOT NULL,
        status TEXT NOT NULL,
        invitation_token_hash TEXT
      )
    `);
    this.addSql("CREATE INDEX idx_users_company ON users (company_id)");
    this.addSql("CREATE INDEX idx_users_invitation_token ON users (invitation_token_hash)");

    this.addSql(`
      CREATE TABLE IF NOT EXISTS consumer_credentials (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        secret_hash TEXT NOT NULL,
        collection_ids TEXT NOT NULL,
        sensitivity_ceiling TEXT NOT NULL,
        status TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      )
    `);
    this.addSql("CREATE INDEX idx_consumer_credentials_company ON consumer_credentials (company_id)");
    this.addSql(
      "CREATE INDEX idx_consumer_credentials_secret_hash ON consumer_credentials (secret_hash)",
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        user_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked BOOLEAN NOT NULL
      )
    `);
    this.addSql("CREATE INDEX idx_sessions_token_hash ON sessions (token_hash)");
    this.addSql("CREATE INDEX idx_sessions_user ON sessions (user_id)");
  }

  public override async down(): Promise<void> {
    this.addSql("DROP TABLE IF EXISTS sessions");
    this.addSql("DROP TABLE IF EXISTS consumer_credentials");
    this.addSql("DROP TABLE IF EXISTS users");
    this.addSql("DROP TABLE IF EXISTS organizations");
  }
}
