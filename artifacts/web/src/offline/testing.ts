import {
  ApiError,
  type Registration,
  type Scan,
  type ScanResult,
} from "@workspace/api-client-react";
import { vi } from "vitest";
import type { ScanOp, UndoOp } from "@/domain/ops";
import { createMemoryStorage } from "@/lib/storage";
import { createOutbox } from "./outbox";
import { createSyncEngine, type SyncApi, type SyncHooks } from "./sync";

/** The error the client throws when the server answers with an HTTP error. */
export const httpError = (status: number) =>
  new ApiError(new Response(null, { status }), null, {
    method: "POST",
    url: "/api/test",
  });

/** The error `fetch` throws when there is no connection. */
export const networkError = () => new TypeError("Failed to fetch");

export const scanOp = (
  studentId: string,
  eventId = "graduation",
  overrides: Partial<ScanOp> = {},
): ScanOp => ({
  type: "scan",
  id: `scan-${studentId}-${eventId}-${Math.random().toString(36).slice(2, 8)}`,
  studentId,
  eventId,
  scannedAt: "2026-06-12T10:42:00.000Z",
  staffId: 2,
  ...overrides,
});

export const undoOp = (
  studentId: string,
  eventId = "graduation",
  overrides: Partial<UndoOp> = {},
): UndoOp => ({
  type: "undo",
  id: `undo-${studentId}-${eventId}-${Math.random().toString(36).slice(2, 8)}`,
  studentId,
  eventId,
  staffId: 2,
  ...overrides,
});

/** A result the way the server words it for a scan that was recorded. */
export const recorded = (scan: Scan, staffId = 2): ScanResult => ({
  id: scan.id,
  outcome: "checked_in",
  studentId: scan.studentId,
  eventId: scan.eventId,
  student: {
    studentId: scan.studentId,
    fullName: `Student ${scan.studentId}`,
    isActive: true,
  },
  registration: {
    studentId: scan.studentId,
    eventId: scan.eventId,
    checkedInAt: scan.scannedAt,
    checkedInBy: staffId,
  },
});

export const refused = (
  scan: Scan,
  outcome: ScanResult["outcome"],
): ScanResult => ({
  id: scan.id,
  outcome,
  studentId: scan.studentId,
  eventId: scan.eventId,
  student: null,
  registration: null,
});

export const cleared = (
  studentId: string,
  eventId = "graduation",
): Registration => ({
  studentId,
  eventId,
  checkedInAt: null,
  checkedInBy: null,
});

/**
 * A sync engine over an in-memory outbox and scripted server calls. By default
 * the server records every scan; override `submitScans` / `undoCheckIn` per test.
 */
export function createTestSync(overrides: Partial<SyncApi> = {}) {
  const outbox = createOutbox(createMemoryStorage(), "test.outbox");
  const calls: string[] = [];
  const api: SyncApi = {
    submitScans: vi.fn(async (scans: Scan[]) => {
      calls.push(`scans:${scans.map((s) => s.studentId).join(",")}`);
      return scans.map((s) => recorded(s));
    }),
    undoCheckIn: vi.fn(async (eventId: string, studentId: string) => {
      calls.push(`undo:${studentId}`);
      return cleared(studentId, eventId);
    }),
    ...overrides,
  };
  const hooks: SyncHooks = {
    onRegistrations: vi.fn(),
    onStale: vi.fn(),
    onUnauthorized: vi.fn(),
    onReachable: vi.fn(),
  };
  const engine = createSyncEngine({
    outbox,
    api,
    hooks,
    now: () => new Date("2026-06-12T12:00:00.000Z"),
  });
  return { outbox, engine, api, hooks, calls };
}
