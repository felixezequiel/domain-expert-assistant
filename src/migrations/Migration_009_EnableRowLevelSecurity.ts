import { Migration } from "@mikro-orm/migrations";

/**
 * Postgres Row-Level Security as the tenant FLOOR (ADR-009 amendment, ADR-022). The
 * application already pre-filters every read by `company_id` (the MikroORM CompanyFilter +
 * explicit WHERE clauses); RLS is the inescapable second layer underneath it — it holds even
 * for a query that forgets the filter or bypasses the ORM entirely, which is exactly the
 * `pgvector` raw similarity query on `chunks` (the hole admitted in ADR-009/022).
 *
 * Mechanism: the UnitOfWork opens one transaction per request, downgrades it to the
 * unprivileged `app_runtime` role with `SET LOCAL ROLE`, and `set_config`s the tenant id into
 * `app.current_company` (or `app.bypass_rls='on'` for privileged operator/system scopes),
 * transaction-locally — so neither the role nor the GUC can leak across pooled connections.
 * The role downgrade is essential: the connection user owns the tables and is a superuser, and
 * BOTH bypass RLS; only a plain role with neither attribute is subject to the policy. Migrations
 * keep running as the owner/superuser (e.g. CREATE EXTENSION needs it), so DDL is unaffected.
 *
 * The policy is FAIL-CLOSED: with no GUC set, `current_setting('app.current_company', true)` is
 * NULL and the predicate matches nothing — a forgotten context returns zero rows, never all.
 *
 * Scope: only the tenant DATA tables, which are exclusively accessed inside a tenant/privileged
 * UnitOfWork scope. The identity/auth tables (organizations, users, sessions,
 * consumer_credentials) are deliberately NOT forced here: session and API-key resolution read
 * them PRE-authentication (before any tenant context exists), keyed by a high-entropy secret
 * hash, and remain guarded by the application CompanyFilter once a context is established.
 * Extending RLS to them requires routing pre-auth lookups through a bypass scope — a tracked
 * follow-up, not a v1 blocker.
 *
 * `tags` additionally exposes system-scoped rows (company_id NULL, scope='system') to every
 * tenant on read (ADR-014) but never lets a tenant write them; `system_events` carries
 * privileged rows (company_id NULL) that only the bypass scope can see or write.
 */
const APP_ROLE = "app_runtime";

const STANDARD_TABLES = [
  "chunks",
  "collections",
  "knowledge_items",
  "knowledge_versions",
  "ingestion_jobs",
] as const;

const TENANT_MATCH =
  "(company_id = current_setting('app.current_company', true) " +
  "OR current_setting('app.bypass_rls', true) = 'on')";

export class Migration_009_EnableRowLevelSecurity extends Migration {
  public override async up(): Promise<void> {
    // Unprivileged runtime role the request transaction downgrades into via SET LOCAL ROLE, so
    // RLS actually applies (the connection superuser/owner would otherwise bypass it). NOLOGIN:
    // it is only ever assumed mid-transaction, never connected to directly.
    this.addSql(
      `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') ` +
        `THEN CREATE ROLE ${APP_ROLE} NOLOGIN; END IF; END $$`,
    );
    this.addSql(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    this.addSql(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    this.addSql(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
    this.addSql(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`,
    );
    // So the connection role can SET ROLE into it (it can as superuser anyway; explicit and
    // future-proof if the connection role is ever downgraded).
    this.addSql(`GRANT ${APP_ROLE} TO CURRENT_USER`);

    for (const table of STANDARD_TABLES) {
      this.enable(table);
      this.addSql(
        `CREATE POLICY tenant_isolation ON ${table} USING ${TENANT_MATCH} WITH CHECK ${TENANT_MATCH}`,
      );
    }

    // tags: own rows + system rows are readable; only own rows (or bypass) are writable.
    this.enable("tags");
    this.addSql(
      "CREATE POLICY tenant_isolation ON tags " +
        "USING (company_id = current_setting('app.current_company', true) " +
        "OR scope = 'system' OR current_setting('app.bypass_rls', true) = 'on') " +
        `WITH CHECK ${TENANT_MATCH}`,
    );

    // system_events: privileged rows (company_id NULL) are visible/writable only under bypass.
    this.enable("system_events");
    this.addSql(
      `CREATE POLICY tenant_isolation ON system_events USING ${TENANT_MATCH} WITH CHECK ${TENANT_MATCH}`,
    );
  }

  public override async down(): Promise<void> {
    for (const table of [...STANDARD_TABLES, "tags", "system_events"]) {
      this.addSql(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
      this.addSql(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
      this.addSql(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
    this.addSql(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM ${APP_ROLE}`,
    );
    this.addSql(`DROP OWNED BY ${APP_ROLE}`);
    this.addSql(`DROP ROLE IF EXISTS ${APP_ROLE}`);
  }

  private enable(table: string): void {
    this.addSql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    // FORCE so the policy applies even to the table owner (defense in depth; the runtime role
    // is not the owner, but a future owner-role query stays subject to the policy too).
    this.addSql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }
}
