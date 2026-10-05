import type { Student } from "@workspace/api-zod";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { studentColumns } from "./columns";

/** Replaces the student's one note; empty text clears it. No history is kept. */
export async function setStudentNote(
  staffId: number,
  studentId: string,
  note: string | null,
): Promise<Student> {
  const [student] = await db
    .update(studentsTable)
    .set({ note: note?.trim() || null })
    .where(eq(studentsTable.studentId, studentId))
    .returning(studentColumns);
  if (!student) throw new HttpError(404, "Student not found");

  logger.info({ staffId, studentId }, "student note changed");
  return student;
}
