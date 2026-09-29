import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
  const scratchFolders: string[] = [];
  let journalLength = 0;

  beforeAll(async () => {
    ({ pool, runMigrations } = await import("./index"));
    ({ checkSchema } = await import("./migrate"));
    ({ resetDatabase } = await import("./testing"));
  });

  // Every test starts from a fully migrated database.
  beforeEach(async () => {
    await resetDatabase(migrationsFolder);
    journalLength = (await journal()).length;
  });

  afterAll(async () => {
    await pool?.end();
    for (const folder of scratchFolders) rmSync(folder, { recursive: true });
  });

  const journal = async () =>
    (
      await pool.query(
        "select hash, created_at from drizzle.__drizzle_migrations order by id",
      )
    ).rows;

  const exists = async (name: string) =>
    (await pool.query("select to_regclass($1) as found", [name])).rows[0]
      .found !== null;

  const defaultOf = async (table: string, column: string) =>
    (
      await pool.query(
        "select column_default from information_schema.columns where table_name = $1 and column_name = $2",
        [table, column],
      )
    ).rows[0].column_default;

  /** What Replit does at publish: the tables arrive, the migration record does not. */
  const dropMigrationRecord = () => pool.query("drop schema drizzle cascade");

  /** A copy of the real migrations with one more migration after them. */
  function withMigration(steps: string[]): string {
    const folder = mkdtempSync(path.join(tmpdir(), "migrations-"));
    scratchFolders.push(folder);
    cpSync(migrationsFolder, folder, { recursive: true });

    const journalFile = path.join(folder, "meta/_journal.json");
    const entries = JSON.parse(readFileSync(journalFile, "utf8"));
    const last = entries.entries.at(-1);
    const number = String(last.idx + 1).padStart(4, "0");
    entries.entries.push({
      idx: last.idx + 1,
      version: last.version,
      when: last.when + 1000,
      tag: `${number}_more`,
      breakpoints: true,
    });
    writeFileSync(journalFile, JSON.stringify(entries));
    writeFileSync(
      path.join(folder, `${number}_more.sql`),
      steps.join("\n--> statement-breakpoint\n"),
    );
    // These steps add no table, index or constraint, so the snapshot is the same.
    copyFileSync(
      path.join(folder, `meta/${last.tag.split("_")[0]}_snapshot.json`),
      path.join(folder, `meta/${number}_snapshot.json`),
    );
    return folder;
  }

  const ADD_NOTE = 'ALTER TABLE "students" ADD COLUMN "note" text;';
  const INACTIVE_BY_DEFAULT =
    'ALTER TABLE "students" ALTER COLUMN "is_active" SET DEFAULT false;';

  it("creates everything the latest migration describes", async () => {
    const { expected, missing } = await checkSchema(pool, migrationsFolder);
    expect(expected.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it("does nothing when everything has already run", async () => {
    expect(await runMigrations(migrationsFolder)).toEqual({
      outcome: "up-to-date",
      alreadyInPlace: [],
    });
  });

  it("migrates an empty database and leaves other tables alone", async () => {
    await dropMigrationRecord();
    await pool.query("drop schema public cascade");
    await pool.query("create schema public");
    await pool.query("create table unrelated (id int)");
    await pool.query("insert into unrelated values (1)");

    expect(await runMigrations(migrationsFolder)).toEqual({
      outcome: "migrated",
      alreadyInPlace: [],
    });
    expect((await checkSchema(pool, migrationsFolder)).missing).toEqual([]);
    expect((await pool.query("select * from unrelated")).rowCount).toBe(1);
  });

  it("records the migrations without running them when the tables are already there", async () => {
    const before = await journal();
    await pool.query(
      "insert into students (student_id, full_name) values ('1001', 'Layla Hassan')",
    );
    await dropMigrationRecord();

    const result = await runMigrations(migrationsFolder);
    // The later steps that only change a check still run: the copy left those as they were.
    expect(result.outcome).toBe("migrated");
    expect(result.alreadyInPlace).toContain('CREATE TABLE "students" (');

    // Nothing was recreated, and the record is what a real run leaves behind.
    expect((await pool.query("select * from students")).rowCount).toBe(1);
    expect(await journal()).toEqual(before);
    expect((await runMigrations(migrationsFolder)).outcome).toBe("up-to-date");
  });

  it("creates the separate steps a partial copy left out", async () => {
    await dropMigrationRecord();
    await pool.query("drop index staff_username_lower_key");
    await pool.query(
      "alter table registrations drop constraint registrations_event_id_events_id_fk",
    );

    const result = await runMigrations(migrationsFolder);
    expect(result.outcome).toBe("migrated");
    expect(result.alreadyInPlace).toContain('CREATE TABLE "students" (');
    expect(
      result.alreadyInPlace.filter(
        (step) =>
          step.includes("staff_username_lower_key") ||
          step.includes("registrations_event_id_events_id_fk"),
      ),
    ).toEqual([]);

    expect((await checkSchema(pool, migrationsFolder)).missing).toEqual([]);
    await pool.query(
      "insert into staff (username, password_hash, display_name) values ('sara', 'x', 'Sara')",
    );
    await expect(
      pool.query(
        "insert into staff (username, password_hash, display_name) values ('SARA', 'x', 'Sara')",
      ),
    ).rejects.toThrow(/staff_username_lower_key/);
    await pool.query(
      "insert into students (student_id, full_name) values ('1001', 'Layla Hassan')",
    );
    await expect(
      pool.query(
        "insert into registrations (student_id, event_id) values ('1001', 'nope')",
      ),
    ).rejects.toThrow(/registrations_event_id_events_id_fk/);
  });

  it("keeps nothing when what exists cannot be completed", async () => {
    await dropMigrationRecord();
    await pool.query("drop table sessions");
    // Part of a table (a column and the check inside its definition): only
    // creating the whole table could bring it back, and it is already there.
    await pool.query("alter table students drop column full_name");

    const failure = await runMigrations(migrationsFolder).catch(
      (error: Error) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("part of the schema");
    expect(message).toContain("column students.full_name");
    expect(message).toContain("constraint students.students_full_name_check");

    // The steps that had run (the sessions table) are undone and nothing is recorded.
    expect(await exists("sessions")).toBe(false);
    expect(await exists("drizzle.__drizzle_migrations")).toBe(false);
  });

  it("runs a later migration that only changes something in place", async () => {
    // Every name in the newer schema is already in the database, so counting
    // names alone would call this one done: it must run.
    const folder = withMigration([INACTIVE_BY_DEFAULT]);

    expect(await runMigrations(folder)).toEqual({
      outcome: "migrated",
      alreadyInPlace: [],
    });
    expect(await defaultOf("students", "is_active")).toBe("false");
    expect(await journal()).toHaveLength(journalLength + 1);
    expect((await runMigrations(folder)).outcome).toBe("up-to-date");
  });

  it("skips the steps a copy already made and runs the rest", async () => {
    const folder = withMigration([ADD_NOTE, INACTIVE_BY_DEFAULT]);
    await pool.query("alter table students add column note text");

    expect(await runMigrations(folder)).toEqual({
      outcome: "migrated",
      alreadyInPlace: [ADD_NOTE],
    });
    expect(await defaultOf("students", "is_active")).toBe("false");
    expect(await journal()).toHaveLength(journalLength + 1);
  });

  it("only records a later migration whose steps a copy has all made", async () => {
    const folder = withMigration([ADD_NOTE]);
    await pool.query("alter table students add column note text");

    expect(await runMigrations(folder)).toEqual({
      outcome: "adopted",
      alreadyInPlace: [ADD_NOTE],
    });
    expect(await journal()).toHaveLength(journalLength + 1);
  });

  it("stops on any other error and changes nothing", async () => {
    const folder = withMigration([
      INACTIVE_BY_DEFAULT,
      'ALTER TABLE "students" ADD COLUMN "broken" nonsense_type;',
    ]);

    await expect(runMigrations(folder)).rejects.toThrow(/nonsense_type/);
    expect(await defaultOf("students", "is_active")).toBe("true");
    expect(await journal()).toHaveLength(journalLength);
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
