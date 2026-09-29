import {
  MAX_STUDENT_ID_LENGTH,
  STUDENT_ID_FORBIDDEN_PATTERN,
} from "@workspace/attendance";
import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  ],
);
