import { pool } from "./client";
import { MIGRATIONS_SCHEMA, runMigrations } from "./migrate";
import { assertScratchDatabase } from "./test-database";

/**
 * Helpers for tests that need a real, empty, fully migrated database.
 *
 * These are destructive, so they refuse to run unless DATABASE_URL is exactly
 * TEST_DATABASE_URL and that database is a scratch one (see test-database.ts):
 * pointing a test run at a real database by accident does nothing.
 */
function assertTestDatabase(): void {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || testUrl !== process.env.DATABASE_URL) {
    throw new Error(
      "Refusing to touch the database: DATABASE_URL must equal TEST_DATABASE_URL.",
    );
  }
  assertScratchDatabase(testUrl);
}

/** Drops everything and applies all migrations from scratch. */
export async function resetDatabase(migrationsFolder: string): Promise<void> {
  assertTestDatabase();
  await pool.query(`drop schema if exists ${MIGRATIONS_SCHEMA} cascade`);
  await pool.query("drop schema public cascade");
  await pool.query("create schema public");
  await runMigrations(migrationsFolder);
}

/** Empties every table but keeps the schema; cheaper than a full reset. */
export async function clearData(): Promise<void> {
  assertTestDatabase();
  await pool.query(
    "truncate registrations, students, events, staff, sessions restart identity cascade",
  );
}
