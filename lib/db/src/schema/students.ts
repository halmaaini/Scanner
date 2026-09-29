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
    // IDs are matched exactly, so an ID with stray spaces could never be
    // scanned or typed. Refuse it at import time instead.
    check("students_student_id_check", sql`${t.studentId} ~ '^\\S+$'`),
    check("students_full_name_check", sql`btrim(${t.fullName}) <> ''`),
  ],
);
