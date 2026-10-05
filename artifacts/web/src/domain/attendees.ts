import {
  indexRoster,
  type Registration,
  type Roster,
  type Student,
} from "./roster";
import { studentMatcher } from "./search";

/** Which attendees to list. */
export type AttendeeStatus = "all" | "in" | "out";

export interface AttendeeRow {
  student: Student;
  registration: Registration;
  /** Who checked them in; null when not checked in or the staff member is unknown. */
  checkedInByName: string | null;
}

/**
 * Everyone registered for an event, with whether they have checked in: the
 * report's attendee list. `query` narrows by ID or name like every search.
 */
export function attendeeRows(
  roster: Roster,
  options: { eventId: string; status: AttendeeStatus; query: string },
): AttendeeRow[] {
  const index = indexRoster(roster);
  const matches = studentMatcher(options.query);
  const rows: AttendeeRow[] = [];

  for (const registration of roster.registrations) {
    if (registration.eventId !== options.eventId) continue;
    const checkedIn = registration.checkedInAt !== null;
    if (options.status === "in" && !checkedIn) continue;
    if (options.status === "out" && checkedIn) continue;

    const student = index.studentById.get(registration.studentId);
    if (!student || (matches && !matches(student))) continue;
    rows.push({
      student,
      registration,
      checkedInByName:
        registration.checkedInBy === null
          ? null
          : (index.staffById.get(registration.checkedInBy)?.displayName ??
            null),
    });
  }

  return rows.sort((a, b) =>
    a.student.studentId.localeCompare(b.student.studentId, undefined, {
      numeric: true,
    }),
  );
}
