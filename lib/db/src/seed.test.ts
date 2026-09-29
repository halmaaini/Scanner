import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { selectTestDatabase } from "./test-database";

// Needs a scratch Postgres: TEST_DATABASE_URL=postgres://... pnpm --filter @workspace/db test
const testUrl = selectTestDatabase();
const root = path.resolve(import.meta.dirname, "../../..");
const seed = readFileSync(path.join(root, "lib/db/sql/seed-demo.sql"), "utf8");
const migrationsFolder = path.join(root, "lib/db/migrations");

describe.skipIf(!testUrl)("demo seed (needs TEST_DATABASE_URL)", () => {
  let pool: (typeof import("./index"))["pool"];
  let clearData: (typeof import("./testing"))["clearData"];

  beforeAll(async () => {
    ({ pool } = await import("./index"));
    const testing = await import("./testing");
    clearData = testing.clearData;
    await testing.resetDatabase(migrationsFolder);
  });

  beforeEach(() => clearData());

  afterAll(async () => {
    await pool?.end();
  });

  const count = async (table: string) =>
    (await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n;

  it("loads into an empty database, and again without duplicating anything", async () => {
    await pool.query(seed);
    await pool.query(seed);
    expect(await count("staff")).toBe(3);
    expect(await count("students")).toBe(10);
    expect(await count("events")).toBe(3);
  });

  it("refuses a database that already has a real account", async () => {
    await pool.query(
      "insert into staff (username, password_hash, display_name) values ('hala', crypt('x', gen_salt('bf', 4)), 'Hala')",
    );
    await expect(pool.query(seed)).rejects.toThrow(
      /Refusing to load demo data/,
    );
    // ...and it changed nothing: no demo account with a well-known password.
    expect(await count("staff")).toBe(1);
  });

  it("refuses a database that already has a real student", async () => {
    await pool.query(
      "insert into students (student_id, full_name) values ('2021-04517', 'Layla Hassan')",
    );
    await expect(pool.query(seed)).rejects.toThrow(
      /Refusing to load demo data/,
    );
    expect(await count("staff")).toBe(0);
  });
});
