import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { selectTestDatabase } from "./test-database";

// Runs every ```sql block in docs/admin-sql.md against the demo data, so the
// cookbook cannot drift away from the schema. Needs TEST_DATABASE_URL.
const testUrl = selectTestDatabase();
const root = path.resolve(import.meta.dirname, "../../..");
const cookbook = readFileSync(path.join(root, "docs/admin-sql.md"), "utf8");
const seed = readFileSync(path.join(root, "lib/db/sql/seed-demo.sql"), "utf8");
const migrationsFolder = path.join(root, "lib/db/migrations");

/** Every fenced sql block, with the HTML comment marker (if any) just above it. */
const blocks = [
  ...cookbook.matchAll(/(<!--\s*([\w-]+)\s*-->\s*)?```sql\n([\s\S]*?)```/g),
].map((match) => ({ marker: match[2], sql: match[3]!.trim() }));

/**
 * Blocks marked `placeholder-password` must refuse to run until the reader has
 * typed a password of their own. Each is run as written (and must refuse), and
 * then with the first occurrence of this text replaced, as a reader would; every such block gets a password of its own so
 * the checks below can tell which one ran last.
 */
const PLACEHOLDER = "type-your-own-password";
const passwordFor = (nth: number) => `password-number-${nth + 1}`;
const guarded = blocks.filter((b) => b.marker === "placeholder-password");

describe.skipIf(!testUrl)(
  "admin SQL cookbook (needs TEST_DATABASE_URL)",
  () => {
    let pool: (typeof import("./index"))["pool"];

    beforeAll(async () => {
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

    /** Runs the cookbook's blocks in order on `client`, the way a reader would. */
    async function runAll(client: {
      query: (text: string) => Promise<unknown>;
    }) {
      for (const [i, block] of blocks.entries()) {
        try {
          if (block.marker === "placeholder-password") {
            // As written, it must refuse (and leave the transaction usable).
            await client.query("savepoint unchanged");
            await expect(client.query(block.sql)).rejects.toThrow(
              /Type a password of your own/,
            );
            await client.query("rollback to savepoint unchanged");
            const nth = guarded.indexOf(block);
            await client.query(
              // Only the first (the line the reader edits), not the check below it.
              block.sql.replace(PLACEHOLDER, passwordFor(nth)),
            );
          } else {
            await client.query(block.sql);
          }
        } catch (error) {
          throw new Error(
            `Cookbook block #${i + 1} failed: ${(error as Error).message}\n\n${block.sql}`,
          );
        }
      }
    }

    it("runs every block, in order, without an error", async () => {
      const client = await pool.connect();
      try {
        // Rolled back at the end, so the demo data is left untouched.
        await client.query("begin");
        await runAll(client);
      } finally {
        await client.query("rollback");
        client.release();
      }
    });

    it("has the changes it describes (spot checks, in one transaction)", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await runAll(client);

        const staff = await client.query(
          "select role, is_active from staff where lower(username) = 'nadia'",
        );
        expect(staff.rows).toEqual([{ role: "super", is_active: true }]);

        // Created with the first password, then reset to the second.
        const login = await client.query(
          "select password_hash = crypt($1, password_hash) as ok from staff where lower(username) = 'nadia'",
          [passwordFor(1)],
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

    it("keeps the two typed-password blocks in step (one to create, one to reset)", () => {
      expect(guarded).toHaveLength(2);
    });

    /** Runs `sql` in a transaction that is rolled back afterwards. */
    async function inTransaction<T>(
      work: (client: import("pg").PoolClient) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        return await work(client);
      } finally {
        await client.query("rollback");
        client.release();
      }
    }

    const marked = (marker: string) => {
      const block = blocks.find((b) => b.marker === marker);
      expect(block, `a block marked ${marker}`).toBeDefined();
      return block!.sql;
    };

    describe("passwords the database makes up", () => {
      const passwordWorks = (
        client: import("pg").PoolClient,
        username: string,
        password: string,
      ) =>
        client
          .query(
            "select password_hash = crypt($1, password_hash) as ok from staff where username = $2",
            [password, username],
          )
          .then((result) => result.rows[0]?.ok);

      it("shows a working password once, for a new account and for a reset", async () => {
        await inTransaction(async (client) => {
          const created = await client.query(marked("create-account"));
          expect(created.rows).toEqual([
            {
              username: "dina",
              password: expect.stringMatching(/^[0-9a-f]{16}$/),
            },
          ]);
          const first = created.rows[0].password as string;
          expect(await passwordWorks(client, "dina", first)).toBe(true);

          const changed = await client.query(marked("reset-password"));
          expect(changed.rows).toHaveLength(1);
          const second = changed.rows[0].password as string;
          expect(second).not.toBe(first);
          expect(await passwordWorks(client, "dina", second)).toBe(true);
          expect(await passwordWorks(client, "dina", first)).toBe(false);
        });
      });

      it("refuses a username that is taken, whatever the case, and creates nothing", async () => {
        await inTransaction(async (client) => {
          await client.query(marked("create-account"));
          await client.query("savepoint again");
          await expect(
            client.query(marked("create-account").replace("'dina'", "'DINA'")),
          ).rejects.toThrow(/staff_username_lower_key/);
          await client.query("rollback to savepoint again");
          const { rows } = await client.query(
            "select count(*)::int as n from staff where lower(username) = 'dina'",
          );
          expect(rows[0].n).toBe(1);
        });
      });

      it("shows no rows, and changes nothing, when a reset names no account", async () => {
        await inTransaction(async (client) => {
          const before = await client.query(
            "select md5(string_agg(password_hash, '' order by id)) as hashes from staff",
          );
          const result = await client.query(
            marked("reset-password").replace("'dina'", "'nobody'"),
          );
          expect(result.rows).toEqual([]);
          const after = await client.query(
            "select md5(string_agg(password_hash, '' order by id)) as hashes from staff",
          );
          expect(after.rows).toEqual(before.rows);
        });
      });

      it("makes the typed-password reset report an account that does not exist", async () => {
        await inTransaction(async (client) => {
          const reset = guarded[1]!.sql
            .replace(PLACEHOLDER, "a-password-of-my-own")
            .replace("'nadia'", "'nobody'");
          await expect(client.query(reset)).rejects.toThrow(
            /There is no account called nobody/,
          );
        });
      });
    });

    it("finds the accounts that still have a demo password, and only those", async () => {
      const findDemo = marked("demo-accounts");
      await inTransaction(async (client) => {
        const before = await client.query(findDemo);
        expect(before.rows.map((r) => r.username).sort()).toEqual([
          "boss",
          "omar",
          "sara",
        ]);

        // A real account, with a password of its own, is not flagged.
        await client.query(marked("create-account"));
        const after = await client.query(findDemo);
        expect(after.rows).toHaveLength(3);

        // And with the demo accounts gone the answer is what the owner wants: nothing.
        await client.query(
          "update registrations set checked_in_at = null, checked_in_by = null",
        );
        await client.query(
          "delete from staff where username in ('boss', 'sara', 'omar')",
        );
        expect((await client.query(findDemo)).rows).toEqual([]);
      });
    });

    it("puts a copy of the lists aside and brings back deleted rows", async () => {
      const copy = blocks.find((b) => b.sql.startsWith("CREATE TABLE backup_"));
      const restore = blocks.find((b) =>
        b.sql.startsWith("INSERT INTO students      SELECT"),
      );
      expect(copy).toBeDefined();
      expect(restore).toBeDefined();
      await inTransaction(async (client) => {
        await client.query(copy!.sql);
        await client.query("delete from students where student_id = '1001'");
        await client.query(restore!.sql);
        const { rows } = await client.query(
          "select (select count(*)::int from students where student_id = '1001') as student, (select count(*)::int from registrations where student_id = '1001') as lists",
        );
        expect(rows[0].student).toBe(1);
        expect(rows[0].lists).toBeGreaterThan(0);
      });
    });
  },
);
