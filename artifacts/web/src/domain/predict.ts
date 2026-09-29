import type { ScanResult } from "@workspace/api-client-react";
import { evaluateScan, isRecorded } from "@workspace/attendance";
import type { ScanOp } from "./ops";
import { indexRoster, type Roster } from "./roster";

/**
 * What the server would most likely answer for this scan, worked out from the
 * saved roster. Used only when the server cannot be reached. It applies the
 * very same rules as the server (`evaluateScan`); only the data can be out of
 * date, which is why the answer is shown as "offline".
 */
export function predictScan(
  roster: Roster,
  scan: Pick<ScanOp, "id" | "studentId" | "eventId" | "scannedAt" | "staffId">,
): ScanResult {
  const index = indexRoster(roster);
  const event = index.eventById.get(scan.eventId);
  const student = index.studentById.get(scan.studentId);
  const registration = index.registration(scan.studentId, scan.eventId);

  const outcome = evaluateScan({ event, student, registration });

  return {
    id: scan.id,
    outcome,
    studentId: scan.studentId,
    eventId: scan.eventId,
    student: student ?? null,
    registration:
      outcome === "checked_in" && registration
        ? {
            ...registration,
            checkedInAt: scan.scannedAt,
            checkedInBy: scan.staffId,
          }
        : isRecorded(outcome)
          ? (registration ?? null)
          : null,
  };
}
