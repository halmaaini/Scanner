import type { Roster } from "@workspace/api-zod";
import {
  db,
  eventsTable,
  registrationsTable,
  staffTable,
  studentsTable,
} from "@workspace/db";
import { asc } from "drizzle-orm";
import {
  eventColumns,
  registrationColumns,
  staffRefColumns,
  studentColumns,
} from "./columns";

/**
 * The whole dataset a scanner works from. Read in one repeatable-read
 * transaction so the four lists describe the same moment (a check-in that
 * lands mid-read cannot appear in one list and not another).
 */
export async function getRoster(): Promise<Roster> {
  return db.transaction(
    async (tx) => {
      const events = await tx
        .select(eventColumns)
        .from(eventsTable)
        .orderBy(asc(eventsTable.sortOrder), asc(eventsTable.id));

      const students = await tx
        .select(studentColumns)
        .from(studentsTable)
        .orderBy(asc(studentsTable.studentId));

      const registrations = await tx
        .select(registrationColumns)
        .from(registrationsTable)
        .orderBy(
          asc(registrationsTable.eventId),
          asc(registrationsTable.studentId),
        );

      // Every staff member, active or not: an old check-in still shows who did it.
      const staff = await tx
        .select(staffRefColumns)
        .from(staffTable)
        .orderBy(asc(staffTable.id));

      return { events, students, registrations, staff };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
