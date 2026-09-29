import { pool } from "./client";
import { runMigrations } from "./migrate";

/**
 * Helpers for tests that need a real, empty, fully migrated database.
 *
 * These are destructive, so they refuse to run unless DATABASE_URL is exactly
 * TEST_DATABASE_URL: pointing a test run at a real database by accident (only
 * DATABASE_URL set) does nothing.
 */
function assertTestDatabase(): void {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || testUrl !== process.env.DATABASE_URL) {
    throw new Error(
      "Refusing to touch the database: DATABASE_URL must equal TEST_DATABASE_URL.",
    );
  }
}

/** Drops everything and applies all migrations from scratch. */
export async function resetDatabase(migrationsFolder: string): Promise<void> {
  assertTestDatabase();
  await pool.query("drop schema if exists drizzle cascade");
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
