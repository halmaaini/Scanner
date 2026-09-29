import { toCsv } from "@/lib/csv";
import { formatSpreadsheetTime } from "@/lib/format";
import { indexRoster, type Roster } from "./roster";

/**
 * Column names and values are fixed English, not UI text: this file is meant
 * to be read by spreadsheets and scripts, and must not change with wording.
 * The time comes twice: in the exporter's own time zone to read in a
 * spreadsheet, and in UTC (ISO 8601) to sort or process without ambiguity.
 */
const HEADER = [
  "student_id",
  "name",
  "major",
  "event",
  "attended",
  "checked_in_at",
  "checked_in_at_utc",
  "checked_in_by",
  "access",
] as const;

/** One row per student per event they are registered for. */
export function buildAttendanceCsv(roster: Roster): string {
  const index = indexRoster(roster);
  const rows: string[][] = [[...HEADER]];

  const eventOrder = new Map(roster.events.map((e, i) => [e.id, i]));
  const registrations = [...roster.registrations].sort(
    (a, b) =>
      (eventOrder.get(a.eventId) ?? 0) - (eventOrder.get(b.eventId) ?? 0) ||
      a.studentId.localeCompare(b.studentId),
  );

  for (const r of registrations) {
    const student = index.studentById.get(r.studentId);
    const event = index.eventById.get(r.eventId);
    if (!student || !event) continue;
    rows.push([
      student.studentId,
      student.fullName,
      student.major ?? "",
      event.name,
      r.checkedInAt ? "yes" : "no",
      r.checkedInAt ? formatSpreadsheetTime(r.checkedInAt) : "",
      r.checkedInAt ?? "",
      r.checkedInBy === null
        ? ""
        : (index.staffById.get(r.checkedInBy)?.displayName ?? ""),
      student.isActive ? "active" : "revoked",
    ]);
  }

  return toCsv(rows);
}
