import type { Card } from "@workspace/api-zod";
import { normalizeStudentId } from "@workspace/attendance";
import {
  db,
  eventsTable,
  registrationsTable,
  studentsTable,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { isoTimestamp, studentColumns } from "./columns";

/** A student's public card, or null if the ID is unknown. */
export async function getCard(rawStudentId: string): Promise<Card | null> {
  const studentId = normalizeStudentId(rawStudentId);

  const [student] = await db
    .select(studentColumns)
    .from(studentsTable)
    .where(eq(studentsTable.studentId, studentId));
  if (!student) return null;

  const events = await db
    .select({
      id: eventsTable.id,
      name: eventsTable.name,
      sortOrder: eventsTable.sortOrder,
      checkedInAt: isoTimestamp(registrationsTable.checkedInAt),
    })
    .from(registrationsTable)
    .innerJoin(eventsTable, eq(registrationsTable.eventId, eventsTable.id))
    .where(eq(registrationsTable.studentId, studentId))
    .orderBy(asc(eventsTable.sortOrder), asc(eventsTable.id));

  return { ...student, events };
}
