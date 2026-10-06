import {
  eventsTable,
  registrationsTable,
  staffTable,
  studentsTable,
} from "@workspace/db";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * The columns behind each shape in the API spec, defined once: a field added
 * to the spec is added here, and every query that returns that shape has it.
 */

/**
 * A timestamp as the API sends it: ISO 8601 in UTC, such as
 * `2026-06-11T10:42:00.123Z`, and null when there is none. The database writes
 * it, so every response gets the same text without any service converting dates.
 */
export function isoTimestamp(column: PgColumn): SQL<string | null> {
  return sql<
    string | null
  >`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

/** What attendees may see about an event (the public card shows exactly this). */
export const eventInfoColumns = {
  id: eventsTable.id,
  name: eventsTable.name,
  sortOrder: eventsTable.sortOrder,
  startsAt: isoTimestamp(eventsTable.startsAt),
  venue: eventsTable.venue,
  mapUrl: eventsTable.mapUrl,
  hasSeating: eventsTable.hasSeating,
};

export const eventColumns = {
  ...eventInfoColumns,
  isOpen: eventsTable.isOpen,
};

/** What the public card may say about a student. Never add staff-only fields here. */
export const publicStudentColumns = {
  studentId: studentsTable.studentId,
  fullName: studentsTable.fullName,
  major: studentsTable.major,
  isActive: studentsTable.isActive,
  seatRow: studentsTable.seatRow,
  seatNumber: studentsTable.seatNumber,
};

/** A student as staff see them: the public facts plus the staff-only note. */
export const studentColumns = {
  ...publicStudentColumns,
  note: studentsTable.note,
};

export const registrationColumns = {
  studentId: registrationsTable.studentId,
  eventId: registrationsTable.eventId,
  checkedInAt: isoTimestamp(registrationsTable.checkedInAt),
  checkedInBy: registrationsTable.checkedInBy,
};

/** Just enough about staff to name who checked someone in. */
export const staffRefColumns = {
  id: staffTable.id,
  displayName: staffTable.displayName,
};

/** Where one student stands on one event's list (a registration is unique per pair). */
export const registrationKey = (studentId: string, eventId: string) =>
  and(
    eq(registrationsTable.studentId, studentId),
    eq(registrationsTable.eventId, eventId),
  );
