import path from "node:path";
import { pool, runMigrations } from "./index";

// `pnpm --filter @workspace/db run migrate`. The API server does the same on
// start-up, so this is only needed to migrate without starting it.
const migrationsFolder = path.resolve(import.meta.dirname, "../migrations");

try {
  await runMigrations(migrationsFolder);
  console.log("Migrations are up to date.");
} finally {
  await pool.end();
}
