import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool } from "./client";

/**
 * Applies any migrations in `migrationsFolder` that have not run yet.
 *
 * Safe to call on every start and from several instances at once: a Postgres
 * advisory lock makes the others wait until the first one has finished, after
 * which they find nothing left to do. Needs no TTY, unlike `drizzle-kit push`.
 */
export async function runMigrations(migrationsFolder: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      "select pg_advisory_lock(hashtext('scanner-migrations'))",
    );
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    try {
      await client.query(
        "select pg_advisory_unlock(hashtext('scanner-migrations'))",
      );
    } finally {
      client.release();
    }
  }
}
