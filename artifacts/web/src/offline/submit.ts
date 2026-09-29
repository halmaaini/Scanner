import type { Registration, ScanResult } from "@workspace/api-client-react";
import {
  MAX_STUDENT_ID_LENGTH,
  normalizeStudentId,
} from "@workspace/attendance";
import type { ScanOp, UndoOp } from "@/domain/ops";
import { predictScan } from "@/domain/predict";
import type { Roster } from "@/domain/roster";
import { randomUuid } from "@/lib/uuid";
import type { Outbox } from "./outbox";
import type { SyncEngine } from "./sync";

/** What a scan came to, for the result screen. */
export type ScanResponse =
  /** A definite answer: from the server, or a rule that needs no server. */
  | { kind: "answered"; result: ScanResult; opId: string }
  /** The server could not be reached; this is the best guess from the saved list. */
  | { kind: "offline"; result: ScanResult; opId: string }
  /** No saved list and no connection: nothing can be said about this ID. */
  | { kind: "unavailable" };

export type UndoResponse =
  | { kind: "done"; registration: Registration | null }
  /** Saved on this device; it reaches the server when the connection returns. */
  | { kind: "queued" }
  | { kind: "refused" };

interface Deps {
  outbox: Outbox;
  engine: SyncEngine;
  now?: () => Date;
  newId?: () => string;
}

export interface ScanInput {
  /** Exactly what was scanned or typed. */
  raw: string;
  eventId: string;
  staffId: number;
  /** The roster as this device sees it now; undefined if none was ever saved. */
  view: Roster | undefined;
}

/**
 * Handles one scan from start to finish.
 *
 * There is a single path: the scan is queued in the outbox, then sent (with
 * anything already waiting, in order). If the server answers, that answer is
 * the truth. If it cannot be reached, the scan stays queued and the person is
 * shown what the saved list predicts, clearly marked as offline. A scan that
 * would not be recorded anyway is not kept, unless a request carrying it may
 * have reached the server (a timeout, a server error): then the server decides.
 *
 * Returns null when there was nothing to scan (blank input).
 */
export async function submitScan(
  { outbox, engine, now = () => new Date(), newId = randomUuid }: Deps,
  { raw, eventId, staffId, view }: ScanInput,
): Promise<ScanResponse | null> {
  const studentId = normalizeStudentId(raw);
  if (!studentId) return null;

  const scan: ScanOp = {
    type: "scan",
    id: newId(),
    studentId,
    eventId,
    scannedAt: now().toISOString(),
    staffId,
  };

  // Too long to be a student ID (a stray QR code): no need to ask anyone.
  if (studentId.length > MAX_STUDENT_ID_LENGTH) {
    return {
      kind: "answered",
      opId: scan.id,
      result: unknownStudent(scan),
    };
  }

  // Judge it against the saved list *before* queueing, so the scan does not
  // find itself already checked in.
  const predicted = view ? predictScan(view, scan) : undefined;

  outbox.add(scan);
  const answer = await engine.send(scan);

  if (answer?.kind === "scan") {
    return { kind: "answered", result: answer.result, opId: scan.id };
  }
  if (answer?.kind === "rejected") {
    // The server could not read the scan at all: as good as an unknown ID.
    return { kind: "answered", result: unknownStudent(scan), opId: scan.id };
  }

  // Not answered: the server could not be reached.
  if (!predicted) {
    engine.cancel(scan.id);
    return { kind: "unavailable" };
  }
  // (If a request carrying it may have reached the server, it stands and the server decides.)
  if (predicted.outcome !== "checked_in") engine.cancel(scan.id);
  return { kind: "offline", result: predicted, opId: scan.id };
}

function unknownStudent(scan: ScanOp): ScanResult {
  return {
    id: scan.id,
    outcome: "unknown_student",
    studentId: scan.studentId,
    eventId: scan.eventId,
    student: null,
    registration: null,
  };
}

/**
 * Undoes a check-in through the same queue as scans, so it is applied after
 * the scan it corrects even if that scan has not reached the server yet.
 *
 * If that scan has not left this device it simply never happens: taking it
 * back beats sending an undo that, by the time it arrives, could land on
 * someone else's check-in of the same student.
 */
export async function submitUndo(
  { outbox, engine, newId = randomUuid }: Deps,
  input: {
    studentId: string;
    eventId: string;
    staffId: number;
    /** The scan being undone, if it may still be waiting on this device. */
    scanOpId?: string;
  },
): Promise<UndoResponse> {
  if (input.scanOpId && engine.cancel(input.scanOpId)) {
    return { kind: "done", registration: null };
  }

  const op: UndoOp = {
    type: "undo",
    id: newId(),
    studentId: input.studentId,
    eventId: input.eventId,
    staffId: input.staffId,
  };
  outbox.add(op);
  const answer = await engine.send(op);

  if (answer?.kind === "undo") {
    return { kind: "done", registration: answer.registration };
  }
  if (answer?.kind === "rejected") return { kind: "refused" };
  return { kind: "queued" };
}
