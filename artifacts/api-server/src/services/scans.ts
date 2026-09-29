import type {
  Registration,
  ScanOutcome,
  ScanResult,
  Staff,
  Student,
} from "@workspace/api-zod";
import { evaluateScan, normalizeStudentId } from "@workspace/attendance";
import {
  db,
  eventsTable,
  registrationsTable,
  studentsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export interface ScanInput {
  id: string;
  studentId: string;
  eventId: string;
  scannedAt: Date;
}

const registrationColumns = {
  studentId: registrationsTable.studentId,
  eventId: registrationsTable.eventId,
  checkedInAt: registrationsTable.checkedInAt,
  checkedInBy: registrationsTable.checkedInBy,
};

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
      .select({
        studentId: studentsTable.studentId,
        fullName: studentsTable.fullName,
        isActive: studentsTable.isActive,
      })
      .from(studentsTable)
      .where(eq(studentsTable.studentId, studentId)),
    db
      .select(registrationColumns)
      .from(registrationsTable)
      .where(
        and(
          eq(registrationsTable.studentId, studentId),
          eq(registrationsTable.eventId, eventId),
        ),
      ),
  ]);
  return { event, student, registration };
}

function toResult(
  scan: ScanInput,
  studentId: string,
  outcome: ScanOutcome,
  facts: Facts,
): ScanResult {
  const recorded = outcome === "checked_in" || outcome === "already_checked_in";
  return {
    id: scan.id,
    outcome,
    studentId,
    eventId: scan.eventId,
    student: facts.student ?? null,
    registration: recorded ? (facts.registration ?? null) : null,
  };
}

/** A scan cannot have happened in the future; a device clock that runs ahead is pulled back. */
function notAfter(scannedAt: Date, now: Date): Date {
  return scannedAt > now ? now : scannedAt;
}

async function recordScan(staff: Staff, scan: ScanInput): Promise<ScanResult> {
  const studentId = normalizeStudentId(scan.studentId);
  const facts = await loadFacts(scan.eventId, studentId);

  // The rules live in one shared function (also used by offline scanners).
  const outcome = evaluateScan(facts);
  if (outcome !== "checked_in")
    return toResult(scan, studentId, outcome, facts);

  // `checkedInAt is null` makes the write itself the guard: if two scanners
  // race for the same student, exactly one update matches.
  const [updated] = await db
    .update(registrationsTable)
    .set({
      checkedInAt: notAfter(scan.scannedAt, new Date()),
      checkedInBy: staff.id,
    })
    .where(
      and(
        eq(registrationsTable.studentId, studentId),
        eq(registrationsTable.eventId, scan.eventId),
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

  // Lost the race: someone else checked the student in after we read it.
  const [current] = await db
    .select(registrationColumns)
    .from(registrationsTable)
    .where(
      and(
        eq(registrationsTable.studentId, studentId),
        eq(registrationsTable.eventId, scan.eventId),
      ),
    );
  return toResult(scan, studentId, "already_checked_in", {
    ...facts,
    registration: current,
  });
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
