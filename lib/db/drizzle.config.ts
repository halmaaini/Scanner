import { defineConfig } from "drizzle-kit";

// Only used to *generate* migration files from the schema (run it from this
// package: `pnpm --filter @workspace/db run generate`; the paths are relative
// to it). Applying them is done by `runMigrations` (src/migrate.ts), which
// needs no TTY.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
});
