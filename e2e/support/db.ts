import { readFileSync } from "node:fs";
import { selectTestDatabase } from "@workspace/db/test-database";
import { SEED_FILE } from "./env";

// @workspace/db reads DATABASE_URL when it is first imported, so the scratch
// database is selected first and the import is deferred until it is needed.
async function load() {
  if (!selectTestDatabase()) {
    throw new Error("TEST_DATABASE_URL must point at a scratch database.");
  }
  const { pool } = await import("@workspace/db");
  const { clearData } = await import("@workspace/db/testing");
  return { pool, clearData };
}

let loaded: ReturnType<typeof load> | undefined;
const database = () => (loaded ??= load());

/** Wait until the API has no query running: a reset must not collide with a late request. */
async function waitForIdle(): Promise<void> {
  const { pool } = await database();
  for (let i = 0; i < 40; i++) {
    const { rows } = await pool.query(
      `select count(*)::int as busy from pg_stat_activity
       where datname = current_database() and pid <> pg_backend_pid() and state = 'active'`,
    );
    if (rows[0].busy === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Empties every table and loads the demo data (see lib/db/sql/seed-demo.sql).
 * The previous test's browser may still have a request in flight; if the
 * database picks this reset as the loser of a deadlock with it, try again.
 */
export async function resetDemoData(): Promise<void> {
  const { pool, clearData } = await database();
  for (let attempt = 1; ; attempt++) {
    try {
      await waitForIdle();
      await clearData();
      await pool.query(readFileSync(SEED_FILE, "utf8"));
      return;
    } catch (error) {
      const deadlock = (error as { code?: string }).code === "40P01";
      if (!deadlock || attempt >= 5) throw error;
    }
  }
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { pool } = await database();
  return (await pool.query(text, params)).rows as T[];
}

export async function closeDatabase(): Promise<void> {
  if (!loaded) return;
  await (await loaded).pool.end();
  loaded = undefined;
}

export interface RegistrationRow {
  checkedInAt: Date | null;
  checkedInBy: number | null;
  by: string | null;
}

/** A student's registration for an event, with the name of who checked them in. */
export async function registrationOf(
  studentId: string,
  eventId: string,
): Promise<RegistrationRow | undefined> {
  const [row] = await sql<RegistrationRow>(
    `select r.checked_in_at as "checkedInAt", r.checked_in_by as "checkedInBy", s.display_name as by
     from registrations r left join staff s on s.id = r.checked_in_by
     where r.student_id = $1 and r.event_id = $2`,
    [studentId, eventId],
  );
  return row;
}
