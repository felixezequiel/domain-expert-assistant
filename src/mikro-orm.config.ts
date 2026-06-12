import { defineConfig } from "@mikro-orm/sqlite";
import { Migrator } from "@mikro-orm/migrations";
import {
  UserEntitySchema,
  AddressEntitySchema,
} from "./modules/user/infrastructure/persistence/mikro-orm/schemas/UserEntitySchema.ts";
import { SystemEventEntitySchema } from "./shared/infrastructure/persistence/adapters/eventStore/SystemEventEntitySchema.ts";

const DATABASE_PATH = "./data/database.sqlite";

export default defineConfig({
  dbName: DATABASE_PATH,
  entities: [UserEntitySchema, AddressEntitySchema, SystemEventEntitySchema],
  extensions: [Migrator],
  migrations: {
    path: "./src/migrations",
    glob: "*.ts",
  },
});
