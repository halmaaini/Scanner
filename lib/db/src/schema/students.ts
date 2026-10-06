import {
  MAX_NOTE_LENGTH,
  MAX_SEAT_NUMBER,
  MAX_STUDENT_ID_LENGTH,
  STUDENT_ID_FORBIDDEN_PATTERN,
} from "@workspace/attendance";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Everyone who can be checked in. The student ID is the identity used
 * everywhere (QR code, manual entry, card link), so it is the primary key.
 * Revoke access with `is_active = false`; that is the only switch.
 */
export const studentsTable = pgTable(
  "students",
  {
    studentId: text("student_id").primaryKey(),
    fullName: text("full_name").notNull(),
    major: text("major"),
    // One free-text note staff can see and edit; it never blocks a check-in.
    note: text("note"),
    // One fixed seat for every seated event: a row letter and a number.
    seatRow: text("seat_row"),
    seatNumber: integer("seat_number"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Every scan, typed ID and card link is cleaned by `normalizeStudentId`
    // and then matched exactly, so an ID it would change (spaces, Arabic
    // digits, hidden marks) could never be found. Refuse those at import time.
    // The rule is built from the same text the normalizer uses; a database
    // test checks the two agree for every character.
    check(
      "students_student_id_check",
      sql`char_length(${t.studentId}) between 1 and ${sql.raw(String(MAX_STUDENT_ID_LENGTH))} and ${t.studentId} is nfkc normalized and ${t.studentId} !~ ${sql.raw(`'${STUDENT_ID_FORBIDDEN_PATTERN}'`)}`,
    ),
    check("students_full_name_check", sql`btrim(${t.fullName}) <> ''`),
    // Whether the hall really has that seat is the shared hall plan's job
    // (`@workspace/attendance`); here it must be a seat-shaped pair that is
    // either complete or absent, and nobody else may hold it.
    unique("students_seat_key").on(t.seatRow, t.seatNumber),
    check(
      "students_seat_check",
      sql`(${t.seatRow} is null and ${t.seatNumber} is null) or (${t.seatRow} is not null and ${t.seatNumber} is not null and ${t.seatRow} ~ '^[A-Z]$' and ${t.seatNumber} between 1 and ${sql.raw(String(MAX_SEAT_NUMBER))})`,
    ),
    // Empty means "no note": it is stored as null, never as blank text.
    check(
      "students_note_check",
      sql`${t.note} is null or (btrim(${t.note}) <> '' and char_length(${t.note}) <= ${sql.raw(String(MAX_NOTE_LENGTH))})`,
    ),
  ],
);
