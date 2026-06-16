import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { OrganizationEntitySchema } from "./modules/identity/infrastructure/persistence/mikro-orm/schemas/OrganizationEntitySchema.ts";
import { UserEntitySchema } from "./modules/identity/infrastructure/persistence/mikro-orm/schemas/UserEntitySchema.ts";
import { ConsumerCredentialEntitySchema } from "./modules/identity/infrastructure/persistence/mikro-orm/schemas/ConsumerCredentialEntitySchema.ts";
import { SessionEntitySchema } from "./modules/identity/infrastructure/persistence/mikro-orm/schemas/SessionEntitySchema.ts";
import { CollectionEntitySchema } from "./modules/knowledge/infrastructure/persistence/mikro-orm/schemas/CollectionEntitySchema.ts";
import { TagEntitySchema } from "./modules/knowledge/infrastructure/persistence/mikro-orm/schemas/TagEntitySchema.ts";
import { KnowledgeItemEntitySchema } from "./modules/knowledge/infrastructure/persistence/mikro-orm/schemas/KnowledgeItemEntitySchema.ts";
import { KnowledgeVersionEntitySchema } from "./modules/knowledge/infrastructure/persistence/mikro-orm/schemas/KnowledgeVersionEntitySchema.ts";
import { IngestionJobEntitySchema } from "./modules/ingestion/infrastructure/persistence/mikro-orm/schemas/IngestionJobEntitySchema.ts";
import { SystemEventEntitySchema } from "./shared/infrastructure/persistence/adapters/eventStore/SystemEventEntitySchema.ts";

/**
 * Postgres is the single persistence engine for every bounded context — domain,
 * governance, event store and the derived vector index (ADR-018). pgvector lives in
 * this same database (extension created by the retrieval migration), which lets hybrid
 * search fuse vector + full-text in one query. There is no SQLite in any environment;
 * dev/CI provision Postgres via docker-compose.
 */
const DEFAULT_PORT = 5432;

export default defineConfig({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? DEFAULT_PORT),
  user: process.env.POSTGRES_USER ?? "domain_expert",
  password: process.env.POSTGRES_PASSWORD ?? "domain_expert",
  dbName: process.env.POSTGRES_DB ?? "domain_expert",
  entities: [
    OrganizationEntitySchema,
    UserEntitySchema,
    ConsumerCredentialEntitySchema,
    SessionEntitySchema,
    CollectionEntitySchema,
    TagEntitySchema,
    KnowledgeItemEntitySchema,
    KnowledgeVersionEntitySchema,
    SystemEventEntitySchema,
  ],
  extensions: [Migrator],
  migrations: {
    path: "./src/migrations",
    glob: "*.ts",
  },
});
