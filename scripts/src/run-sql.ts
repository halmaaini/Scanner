import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "@workspace/db";

// Runs a .sql file against DATABASE_URL, no TTY and no psql needed (handy on
// Replit). Relative paths are read from where you ran it. The whole file is one
// implicit transaction: if any statement fails, none of it takes effect. Rows
// returned by SELECT statements are printed, so you can see what is there.
//
//   pnpm --filter @workspace/scripts run sql my-changes.sql
//
// DATABASE_URL is the development database in a Replit workspace shell; the
// published site has its own (see docs/admin-sql.md).
const file = process.argv[2];

if (!file) {
  console.error("Usage: pnpm --filter @workspace/scripts run sql <file.sql>");
  process.exit(1);
}

const fullPath = path.resolve(process.env.INIT_CWD ?? process.cwd(), file);

try {
  // The driver returns one result per statement when the file holds several.
  const outcome: unknown = await pool.query(await readFile(fullPath, "utf8"));
  for (const result of (Array.isArray(outcome) ? outcome : [outcome]) as {
    command: string;
    rows: unknown[];
    fields: { name: string }[];
  }[]) {
    if (result.command !== "SELECT") continue;
    if (result.rows.length > 0) console.table(result.rows);
    else
      console.log(`(${result.fields.map((f) => f.name).join(", ")}: no rows)`);
  }
  console.log(`Ran ${path.relative(process.cwd(), fullPath)}`);
} finally {
  await pool.end();
}
