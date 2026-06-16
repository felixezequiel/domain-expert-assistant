import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import {
  UserEntitySchema,
  AddressEntitySchema,
} from "./modules/user/infrastructure/persistence/mikro-orm/schemas/UserEntitySchema.ts";
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
  entities: [UserEntitySchema, AddressEntitySchema, SystemEventEntitySchema],
  extensions: [Migrator],
  migrations: {
    path: "./src/migrations",
    glob: "*.ts",
  },
});
