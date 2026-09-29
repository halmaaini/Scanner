import type { Server } from "node:http";
import path from "node:path";
import { pool } from "@workspace/db";
import { clearData, resetDatabase } from "@workspace/db/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { createApp, type AppOptions } from "../app";

const migrationsFolder = path.resolve(
  import.meta.dirname,
  "../../../../lib/db/migrations",
);

const servers: Server[] = [];

/** Registers a suite that runs only when a scratch database is configured. */
export function describeWithDb(name: string, suite: () => void): void {
  describe.skipIf(!process.env.TEST_DATABASE_URL)(name, () => {
    beforeAll(() => resetDatabase(migrationsFolder));
    beforeEach(() => clearData());
    afterAll(async () => {
      await Promise.all(
        servers.splice(0).map((s) => new Promise((done) => s.close(done))),
      );
      await pool.end();
    });
    suite();
  });
}

/**
 * A signed-out client for a fresh app; limits are loose unless overridden.
 * Each client talks to its own listening server (closed after the suite), so
 * simultaneous requests share one connection setup instead of racing to make it.
 */
export function createClient(options: AppOptions = {}) {
  const loose = { windowMs: 60_000, limit: 10_000 };
  const server = createApp({
    loginRateLimit: loose,
    cardRateLimit: loose,
    ...options,
  }).listen(0);
  servers.push(server);
  return request.agent(server);
}

export type Client = ReturnType<typeof createClient>;

// ---- Test data, written as plain SQL so tests read like the SQL cookbook ----

export async function addStaff(
  username: string,
  options: {
    password?: string;
    displayName?: string;
    role?: "admin" | "super";
    isActive?: boolean;
  } = {},
): Promise<number> {
  const {
    password = "pw",
    displayName = username,
    role = "admin",
    isActive = true,
  } = options;
  const { rows } = await pool.query(
    `insert into staff (username, password_hash, display_name, role, is_active)
     values ($1, crypt($2, gen_salt('bf', 4)), $3, $4, $5) returning id`,
    [username, password, displayName, role, isActive],
  );
  return rows[0].id;
}

export async function addEvent(
  id: string,
  options: { name?: string; sortOrder?: number; isOpen?: boolean } = {},
): Promise<void> {
  const { name = id, sortOrder = 0, isOpen = true } = options;
  await pool.query(
    "insert into events (id, name, sort_order, is_open) values ($1, $2, $3, $4)",
    [id, name, sortOrder, isOpen],
  );
}

export async function addStudent(
  studentId: string,
  fullName = `Student ${studentId}`,
  isActive = true,
): Promise<void> {
  await pool.query(
    "insert into students (student_id, full_name, is_active) values ($1, $2, $3)",
    [studentId, fullName, isActive],
  );
}

export async function register(
  studentId: string,
  eventId: string,
  checkedIn?: { by: number; at?: string },
): Promise<void> {
  await pool.query(
    "insert into registrations (student_id, event_id, checked_in_at, checked_in_by) values ($1, $2, $3, $4)",
    [
      studentId,
      eventId,
      checkedIn ? (checkedIn.at ?? new Date().toISOString()) : null,
      checkedIn ? checkedIn.by : null,
    ],
  );
}

export async function registrationOf(studentId: string, eventId: string) {
  const { rows } = await pool.query(
    `select checked_in_at as "checkedInAt", checked_in_by as "checkedInBy"
     from registrations where student_id = $1 and event_id = $2`,
    [studentId, eventId],
  );
  return rows[0] as { checkedInAt: Date | null; checkedInBy: number | null };
}

export async function signIn(
  client: Client,
  username: string,
  password = "pw",
): Promise<void> {
  const res = await client.post("/api/auth/login").send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${username}: ${res.status}`);
  }
}

/** One scan as the API expects it. */
export function scan(
  studentId: string,
  eventId: string,
  overrides: { id?: string; scannedAt?: string } = {},
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    studentId,
    eventId,
    scannedAt: overrides.scannedAt ?? new Date().toISOString(),
  };
}
