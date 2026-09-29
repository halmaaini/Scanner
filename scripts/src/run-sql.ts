import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@workspace/db";

// Runs a .sql file against DATABASE_URL, statements and all, with no TTY and no
// psql needed (handy on Replit). Relative paths are read from where you ran it.
//
//   pnpm --filter @workspace/scripts run sql lib/db/sql/seed-demo.sql
const file = process.argv[2];

if (!file) {
  console.error("Usage: pnpm --filter @workspace/scripts run sql <file.sql>");
  process.exit(1);
}

if (
  path.basename(file).includes("demo") &&
  process.env.NODE_ENV === "production"
) {
  console.error("Refusing to load demo data with NODE_ENV=production.");
  process.exit(1);
}

const fullPath = path.resolve(process.env.INIT_CWD ?? process.cwd(), file);

try {
  await pool.query(await readFile(fullPath, "utf8"));
  console.log(`Ran ${path.relative(process.cwd(), fullPath)}`);
} finally {
  await pool.end();
}
