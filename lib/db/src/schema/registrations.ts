import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { staffTable } from "./staff";
import { studentsTable } from "./students";

/**
 * One row per student per event they are expected at. The same row is the
 * attendance record, so "who is expected" and "who has attended" can never
 * disagree: a student has checked in when `checked_in_at` is set.
 *
 * Add a student to an event by inserting a row; remove them by deleting it.
 * Undo a check-in by setting both check-in columns back to null.
 */
export const registrationsTable = pgTable(
  "registrations",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => studentsTable.studentId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    eventId: text("event_id")
      .notNull()
      .references(() => eventsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    // No delete rule on purpose: staff who checked people in are deactivated,
    // not deleted, so the record of who did what stays intact.
    checkedInBy: integer("checked_in_by").references(() => staffTable.id),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.eventId] }),
    index("registrations_event_id_idx").on(t.eventId),
    // A check-in always has both a time and a person, or neither.
    check(
      "registrations_check_in_pair_check",
      sql`(${t.checkedInAt} is null) = (${t.checkedInBy} is null)`,
    ),
  ],
);
