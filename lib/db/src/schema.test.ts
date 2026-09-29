import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeStudentId } from "@workspace/attendance";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { selectTestDatabase } from "./test-database";

// Needs a scratch Postgres: TEST_DATABASE_URL=postgres://... pnpm --filter @workspace/db test
const testUrl = selectTestDatabase();
const migrationsFolder = path.resolve(import.meta.dirname, "../migrations");
const migrationCount = (
  JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: unknown[] }
).entries.length;

const char = String.fromCodePoint;

type Db = typeof import("./index");
type Testing = typeof import("./testing");

describe.skipIf(!testUrl)("database schema (needs TEST_DATABASE_URL)", () => {
  let pool: Db["pool"];
  let runMigrations: Db["runMigrations"];
  let resetDatabase: Testing["resetDatabase"];
  let clearData: Testing["clearData"];

  beforeAll(async () => {
    ({ pool, runMigrations } = await import("./index"));
    ({ resetDatabase, clearData } = await import("./testing"));
    await resetDatabase(migrationsFolder);
  });

  beforeEach(async () => {
    await clearData();
  });

  afterAll(async () => {
    await pool?.end();
  });

  const sql = (text: string, params: unknown[] = []) =>
    pool.query(text, params);

  const addStudent = (id = "1001", name = "Layla Hassan") =>
    sql("insert into students (student_id, full_name) values ($1, $2)", [
      id,
      name,
    ]);
  const addEvent = (id = "graduation") =>
    sql("insert into events (id, name) values ($1, $2)", [id, "Graduation"]);
  const addStaff = (username = "sara", role = "admin") =>
    sql(
      `insert into staff (username, password_hash, display_name, role)
       values ($1, crypt('pw', gen_salt('bf', 4)), 'Sara', $2) returning id`,
      [username, role],
    );

  it("applies migrations repeatedly without error, recording each once", async () => {
    expect((await runMigrations(migrationsFolder)).outcome).toBe("up-to-date");
    expect((await runMigrations(migrationsFolder)).outcome).toBe("up-to-date");
    const { rows } = await sql(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    expect(rows[0].n).toBe(migrationCount);
  });

  // The advisory lock is what makes several instances starting together safe:
  // without it the second one meets tables the first is still creating.
  it("lets exactly one of several simultaneous starts migrate an empty database", async () => {
    await sql("drop schema drizzle cascade");
    await sql("drop schema public cascade");
    await sql("create schema public");

    const starts = await Promise.allSettled([
      runMigrations(migrationsFolder),
      runMigrations(migrationsFolder),
      runMigrations(migrationsFolder),
    ]);

    expect(starts.map((start) => start.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    const outcomes = starts.map(
      (start) =>
        (start as PromiseFulfilledResult<{ outcome: string }>).value.outcome,
    );
    expect(outcomes.filter((outcome) => outcome === "migrated")).toHaveLength(
      1,
    );
    expect(outcomes.filter((outcome) => outcome === "up-to-date")).toHaveLength(
      2,
    );
    const { rows } = await sql(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    expect(rows[0].n).toBe(migrationCount);
  });

  it("hashes passwords with pgcrypto, the way the SQL cookbook creates accounts", async () => {
    await addStaff("sara");
    const good = await sql(
      "select password_hash = crypt($1, password_hash) as ok from staff",
      ["pw"],
    );
    const bad = await sql(
      "select password_hash = crypt($1, password_hash) as ok from staff",
      ["nope"],
    );
    expect(good.rows[0].ok).toBe(true);
    expect(bad.rows[0].ok).toBe(false);
  });

  it("keeps usernames unique regardless of case", async () => {
    await addStaff("Sara");
    await expect(addStaff("sara")).rejects.toThrow(/staff_username_lower_key/);
  });

  it("only allows the known staff roles", async () => {
    await expect(addStaff("root", "root")).rejects.toThrow(/staff_role_check/);
    await expect(addStaff("boss", "super")).resolves.toBeDefined();
  });

  it("rejects student IDs that could never be matched", async () => {
    const rejected = [
      "10 01",
      " 1001",
      "",
      `10${char(0x200f)}01`, // hidden right-to-left mark
      `10${char(0x061c)}01`, // Arabic letter mark
      char(0x0661, 0x0660, 0x0660, 0x0661), // Arabic-Indic digits
      char(0xff11, 0xff10, 0xff10, 0xff11), // full-width digits
      "1".repeat(65), // longer than any ID the API accepts
    ];
    for (const id of rejected) {
      await expect(addStudent(id), JSON.stringify(id)).rejects.toThrow(
        /students_student_id_check/,
      );
    }
    await expect(addStudent("1001", "  ")).rejects.toThrow(
      /students_full_name_check/,
    );
    await expect(addStudent("2021-04517")).resolves.toBeDefined();
    await expect(addStudent("CS/2021/045")).resolves.toBeDefined();
    await expect(addStudent("1".repeat(64))).resolves.toBeDefined();
  });

  // The scanner cleans every ID with normalizeStudentId before matching it
  // exactly, so the database may store an ID only if that function would leave
  // it alone. Checked with the real constraint, for every character.
  it("stores exactly the IDs that normalizeStudentId leaves unchanged", async () => {
    const { rows } = await sql(
      `select pg_get_expr(conbin, conrelid) as rule from pg_constraint
       where conname = 'students_student_id_check'`,
    );
    const accepted = await sql(
      `select code from
         (select code from generate_series(1, 65535) as code
          where code not between 55296 and 57343) as codes,
         lateral (select 'A' || chr(code) || '1' as student_id) as candidate
       where ${rows[0].rule}`,
    );
    const inDatabase = new Set(accepted.rows.map((row) => row.code));

    const disagreements: string[] = [];
    const newerThanPostgres: string[] = [];
    for (let code = 1; code <= 0xffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const id = `A${char(code)}1`;
      const unchanged = normalizeStudentId(id) === id;
      if (unchanged === inDatabase.has(code)) continue;

      const name = `U+${code.toString(16).padStart(4, "0")}`;
      // Node's Unicode tables can be a release ahead of Postgres's, so a
      // character added lately may be folded by Node but still stored. Any other
      // difference is a real mismatch between the rule and the constraint.
      if (inDatabase.has(code) && id.normalize("NFKC") !== id) {
        newerThanPostgres.push(name);
      } else {
        disagreements.push(name);
      }
    }
    expect(disagreements).toEqual([]);
    // If the constraint forgot NFKC altogether this would be in the hundreds.
    expect(newerThanPostgres.length).toBeLessThan(10);
  });

  it("requires event ids to be lowercase slugs", async () => {
    await expect(addEvent("Graduation")).rejects.toThrow(/events_id_check/);
    await expect(addEvent("grad day")).rejects.toThrow(/events_id_check/);
    await expect(addEvent("graduation-2026")).resolves.toBeDefined();
  });

  it("never allows half a check-in", async () => {
    await addStudent();
    await addEvent();
    const staff = await addStaff();
    const staffId = staff.rows[0].id;
    await sql(
      "insert into registrations (student_id, event_id) values ('1001', 'graduation')",
    );
    await expect(
      sql("update registrations set checked_in_at = now()"),
    ).rejects.toThrow(/registrations_check_in_pair_check/);
    await expect(
      sql("update registrations set checked_in_by = $1", [staffId]),
    ).rejects.toThrow(/registrations_check_in_pair_check/);
    await sql(
      "update registrations set checked_in_at = now(), checked_in_by = $1",
      [staffId],
    );
    await sql(
      "update registrations set checked_in_at = null, checked_in_by = null",
    );
  });

  it("registers a student for an event only once", async () => {
    await addStudent();
    await addEvent();
    await sql(
      "insert into registrations (student_id, event_id) values ('1001', 'graduation')",
    );
    await expect(
      sql(
        "insert into registrations (student_id, event_id) values ('1001', 'graduation')",
      ),
    ).rejects.toThrow(/registrations_student_id_event_id_pk/);
  });

  it("cascades student and event deletes and follows ID corrections", async () => {
    await addStudent("1001");
    await addStudent("1002");
    await addEvent();
    await sql(
      "insert into registrations (student_id, event_id) values ('1001', 'graduation'), ('1002', 'graduation')",
    );

    await sql(
      "update students set student_id = '9001' where student_id = '1001'",
    );
    const moved = await sql("select student_id from registrations order by 1");
    expect(moved.rows.map((r) => r.student_id)).toEqual(["1002", "9001"]);

    await sql("delete from students where student_id = '9001'");
    expect((await sql("select 1 from registrations")).rowCount).toBe(1);
    await sql("delete from events");
    expect((await sql("select 1 from registrations")).rowCount).toBe(0);
  });

  it("refuses to delete staff who have checked people in", async () => {
    await addStudent();
    await addEvent();
    const staff = await addStaff();
    await sql(
      "insert into registrations (student_id, event_id, checked_in_at, checked_in_by) values ('1001', 'graduation', now(), $1)",
      [staff.rows[0].id],
    );
    await expect(sql("delete from staff")).rejects.toThrow(
      /registrations_checked_in_by_staff_id_fk/,
    );
  });

  // The helpers ask the connection itself which database it is on, so no
  // setting or import order can point a wipe at a real one.
  it("refuses to run destructive helpers on a connection to a non-test database", async () => {
    const query = vi
      .spyOn(pool, "query")
      .mockResolvedValue({ rows: [{ name: "heliumdb" }] } as never);
    try {
      await expect(clearData()).rejects.toThrow(
        /Refusing to use the database "heliumdb"/,
      );
      await expect(resetDatabase(migrationsFolder)).rejects.toThrow(/Refusing/);
      // Nothing but the question was asked: no truncate, no drop.
      expect(query).toHaveBeenCalledTimes(2);
      for (const [text] of query.mock.calls) {
        expect(String(text)).toContain("current_database()");
      }
    } finally {
      query.mockRestore();
    }
  });
});
