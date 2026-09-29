import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { selectTestDatabase } from "./test-database";

// Needs a scratch Postgres: TEST_DATABASE_URL=postgres://... pnpm --filter @workspace/db test
const testUrl = selectTestDatabase();
const migrationsFolder = path.resolve(import.meta.dirname, "../migrations");

type Db = typeof import("./index");
type Migrate = typeof import("./migrate");
type Testing = typeof import("./testing");

describe.skipIf(!testUrl)("migrations (needs TEST_DATABASE_URL)", () => {
  let pool: Db["pool"];
  let runMigrations: Db["runMigrations"];
  let checkSchema: Migrate["checkSchema"];
  let resetDatabase: Testing["resetDatabase"];

  beforeAll(async () => {
    ({ pool, runMigrations } = await import("./index"));
    ({ checkSchema } = await import("./migrate"));
    ({ resetDatabase } = await import("./testing"));
  });

  // Every test starts from a fully migrated database.
  beforeEach(() => resetDatabase(migrationsFolder));

  afterAll(async () => {
    await pool?.end();
  });

  const journal = async () =>
    (
      await pool.query(
        "select hash, created_at from drizzle.__drizzle_migrations order by id",
      )
    ).rows;

  /** What Replit does at publish: the tables arrive, the migration record does not. */
  const dropMigrationRecord = () => pool.query("drop schema drizzle cascade");

  it("creates everything the latest migration describes", async () => {
    const { expected, missing } = await checkSchema(pool, migrationsFolder);
    expect(expected.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it("does nothing when everything has already run", async () => {
    expect(await runMigrations(migrationsFolder)).toBe("up-to-date");
  });

  it("migrates an empty database and leaves other tables alone", async () => {
    await dropMigrationRecord();
    await pool.query("drop schema public cascade");
    await pool.query("create schema public");
    await pool.query("create table unrelated (id int)");
    await pool.query("insert into unrelated values (1)");

    expect(await runMigrations(migrationsFolder)).toBe("migrated");
    expect((await checkSchema(pool, migrationsFolder)).missing).toEqual([]);
    expect((await pool.query("select * from unrelated")).rowCount).toBe(1);
  });

  it("records the migrations without running them when the tables are already there", async () => {
    const before = await journal();
    await pool.query(
      "insert into students (student_id, full_name) values ('1001', 'Layla Hassan')",
    );
    await dropMigrationRecord();

    expect(await runMigrations(migrationsFolder)).toBe("adopted");

    // Nothing was recreated, and the record is what a real run leaves behind.
    expect((await pool.query("select * from students")).rowCount).toBe(1);
    expect(await journal()).toEqual(before);
    expect(await runMigrations(migrationsFolder)).toBe("up-to-date");
  });

  it("names what is missing when only part of the schema is there", async () => {
    await dropMigrationRecord();
    await pool.query(
      "alter table students drop constraint students_student_id_check",
    );
    await pool.query("drop index staff_username_lower_key");

    const failure = await runMigrations(migrationsFolder).catch(
      (error: Error) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("part of the schema");
    expect(message).toContain("constraint students.students_student_id_check");
    expect(message).toContain("index staff.staff_username_lower_key");
    // The original error is kept for the log.
    expect((failure as Error).cause).toBeDefined();
  });

  it("creates the pgcrypto extension itself", async () => {
    await pool.query("drop extension pgcrypto");
    await runMigrations(migrationsFolder);
    const { rows } = await pool.query(
      "select crypt('pw', gen_salt('bf', 4)) is not null as ok",
    );
    expect(rows[0].ok).toBe(true);
  });
});
