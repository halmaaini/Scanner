import { pool } from "./client";
import { MIGRATIONS_SCHEMA, runMigrations } from "./migrate";
import { assertScratchName } from "./test-database";

/**
 * Helpers for tests that need a real, empty, fully migrated database.
 *
 * These are destructive, so before wiping anything they ask the connection
 * itself which database it is on and refuse unless that is a scratch one (see
 * test-database.ts): pointing a test run at a real database by accident, by
 * whatever route, does nothing.
 */
async function assertTestDatabase(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>(
    "select current_database() as name",
  );
  assertScratchName(rows[0]?.name ?? "");
}

/** Drops everything and applies all migrations from scratch. */
export async function resetDatabase(migrationsFolder: string): Promise<void> {
  await assertTestDatabase();
  await pool.query(`drop schema if exists ${MIGRATIONS_SCHEMA} cascade`);
  await pool.query("drop schema public cascade");
  await pool.query("create schema public");
  await runMigrations(migrationsFolder);
}

/** Empties every table but keeps the schema; cheaper than a full reset. */
export async function clearData(): Promise<void> {
  await assertTestDatabase();
  await pool.query(
    "truncate registrations, students, events, staff, sessions restart identity cascade",
  );
}
