import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs every ```sql block in docs/admin-sql.md against the demo data, so the
// cookbook cannot drift away from the schema. Needs TEST_DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL;
const root = path.resolve(import.meta.dirname, "../../..");
const cookbook = readFileSync(path.join(root, "docs/admin-sql.md"), "utf8");
const seed = readFileSync(path.join(root, "lib/db/sql/seed-demo.sql"), "utf8");
const migrationsFolder = path.join(root, "lib/db/migrations");

/** Every fenced sql block, with the HTML comment marker (if any) just above it. */
const blocks = [
  ...cookbook.matchAll(/(<!--\s*([\w-]+)\s*-->\s*)?```sql\n([\s\S]*?)```/g),
].map((match) => ({ marker: match[2], sql: match[3]!.trim() }));

describe.skipIf(!testUrl)(
  "admin SQL cookbook (needs TEST_DATABASE_URL)",
  () => {
    let pool: (typeof import("./index"))["pool"];

    beforeAll(async () => {
      process.env.DATABASE_URL = testUrl;
      ({ pool } = await import("./index"));
      const { resetDatabase } = await import("./testing");
      await resetDatabase(migrationsFolder);
      await pool.query(seed);
    });

    afterAll(async () => {
      await pool?.end();
    });

    it("has SQL to run", () => {
      expect(blocks.length).toBeGreaterThan(30);
    });

    it("counts attendance the way the app does", async () => {
      const report = blocks.find((b) => b.marker === "attendance-report");
      expect(report).toBeDefined();
      const { rows } = await pool.query(report!.sql);
      // Ten students, one revoked; five already checked in to the rehearsal.
      expect(rows).toEqual([
        { event: "Rehearsal", checked_in: "5", expected: "9" },
        { event: "Graduation ceremony", checked_in: "0", expected: "9" },
        { event: "Trophy handover", checked_in: "0", expected: "3" },
      ]);
    });

    it("runs every block, in order, without an error", async () => {
      const client = await pool.connect();
      try {
        // Rolled back at the end, so the demo data is left untouched.
        await client.query("begin");
        for (const [i, block] of blocks.entries()) {
          try {
            await client.query(block.sql);
          } catch (error) {
            throw new Error(
              `Cookbook block #${i + 1} failed: ${(error as Error).message}\n\n${block.sql}`,
            );
          }
        }
      } finally {
        await client.query("rollback");
        client.release();
      }
    });

    it("has the changes it describes (spot checks, in one transaction)", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const block of blocks) await client.query(block.sql);

        const staff = await client.query(
          "select role, is_active from staff where lower(username) = 'nadia'",
        );
        expect(staff.rows).toEqual([{ role: "super", is_active: true }]);

        const login = await client.query(
          "select password_hash = crypt('a-new-password', password_hash) as ok from staff where lower(username) = 'nadia'",
        );
        expect(login.rows).toEqual([{ ok: true }]);

        const revived = await client.query(
          "select is_active from students where student_id = '1012'",
        );
        expect(revived.rows).toEqual([{ is_active: true }]);
      } finally {
        await client.query("rollback");
        client.release();
      }
    });
  },
);
