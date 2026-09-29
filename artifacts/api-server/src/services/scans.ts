import type {
  Registration,
  ScanOutcome,
  ScanResult,
  Staff,
  Student,
} from "@workspace/api-zod";
import {
  evaluateScan,
  isRecorded,
  normalizeStudentId,
} from "@workspace/attendance";
import {
  db,
  eventsTable,
  registrationsTable,
  studentsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  registrationColumns,
  registrationKey,
  studentColumns,
} from "./columns";

export interface ScanInput {
  id: string;
  studentId: string;
  eventId: string;
  /** ISO 8601 time the scan physically happened. */
  scannedAt: string;
}

/**
 * How many times one scan is judged again after another scanner (or an undo)
 * changed its registration between reading and writing. A second is already
 * far-fetched; three in a row means something is wrong, and the scan is left
 * queued on the scanner to be retried.
 */
const MAX_ATTEMPTS = 3;

interface Facts {
  event: { id: string } | undefined;
  student: Student | undefined;
  registration: Registration | undefined;
}

async function loadFacts(eventId: string, studentId: string): Promise<Facts> {
  const [[event], [student], [registration]] = await Promise.all([
    db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId)),
    db
      .select(studentColumns)
      .from(studentsTable)
      .where(eq(studentsTable.studentId, studentId)),
    db
      .select(registrationColumns)
      .from(registrationsTable)
      .where(registrationKey(studentId, eventId)),
  ]);
  return { event, student, registration };
}

function toResult(
  scan: ScanInput,
  studentId: string,
  outcome: ScanOutcome,
  facts: Facts,
): ScanResult {
  return {
    id: scan.id,
    outcome,
    studentId,
    eventId: scan.eventId,
    student: facts.student ?? null,
    registration: isRecorded(outcome) ? (facts.registration ?? null) : null,
  };
}

/** A scan cannot have happened in the future; a device clock that runs ahead is pulled back. */
function notAfter(scannedAt: Date, now: Date): Date {
  return scannedAt > now ? now : scannedAt;
}

async function recordScan(staff: Staff, scan: ScanInput): Promise<ScanResult> {
  const studentId = normalizeStudentId(scan.studentId);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const facts = await loadFacts(scan.eventId, studentId);

    // The rules live in one shared function (also used by offline scanners).
    const outcome = evaluateScan(facts);
    if (outcome !== "checked_in") {
      return toResult(scan, studentId, outcome, facts);
    }

    // `checkedInAt is null` makes the write itself the guard: if two scanners
    // race for the same student, exactly one update matches.
    const [updated] = await db
      .update(registrationsTable)
      .set({
        checkedInAt: notAfter(new Date(scan.scannedAt), new Date()),
        checkedInBy: staff.id,
      })
      .where(
        and(
          registrationKey(studentId, scan.eventId),
          isNull(registrationsTable.checkedInAt),
        ),
      )
      .returning(registrationColumns);

    if (updated) {
      return toResult(scan, studentId, "checked_in", {
        ...facts,
        registration: updated,
      });
    }
    // Lost the race: the registration changed after it was read. Judge the
    // scan again on what is there now (checked in by someone else, removed,
    // or undone and free again) rather than guess.
  }

  throw new Error(
    `Scan ${scan.id} could not be recorded: its registration kept changing`,
  );
}

/**
 * Records scans one after another, so a later scan in the same batch sees the
 * effect of an earlier one (the second scan of one student is a repeat).
 * A scan that cannot be recorded is an ordinary result, not an error.
 */
export async function recordScans(
  staff: Staff,
  scans: ScanInput[],
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  for (const scan of scans) {
    results.push(await recordScan(staff, scan));
  }
  return results;
}
