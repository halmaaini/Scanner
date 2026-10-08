import type { Card } from "@workspace/api-zod";
import { neighbourSeats, normalizeStudentId } from "@workspace/attendance";
import {
  db,
  eventsTable,
  registrationsTable,
  studentsTable,
} from "@workspace/db";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  eventInfoColumns,
  isoTimestamp,
  publicStudentColumns,
} from "./columns";

/** A student's public card, or null if the ID is unknown. */
export async function getCard(rawStudentId: string): Promise<Card | null> {
  const studentId = normalizeStudentId(rawStudentId);

  const [student] = await db
    .select(publicStudentColumns)
    .from(studentsTable)
    .where(eq(studentsTable.studentId, studentId));
  if (!student) return null;

  const events = await db
    .select({
      ...eventInfoColumns,
      checkedInAt: isoTimestamp(registrationsTable.checkedInAt),
    })
    .from(registrationsTable)
    .innerJoin(eventsTable, eq(registrationsTable.eventId, eventsTable.id))
    .where(eq(registrationsTable.studentId, studentId))
    .orderBy(asc(eventsTable.sortOrder), asc(eventsTable.id));

  const seated =
    student.seatRow !== null &&
    student.seatNumber !== null &&
    events.some((event) => event.hasSeating);
  if (!seated) return { ...student, neighbours: [], occupiedSeats: [], events };

  // The hall plan decides who counts as a neighbour (same block, next number).
  const besides = neighbourSeats(student.seatRow!, student.seatNumber!);
  const neighbours = besides.length
    ? await db
        .select({
          seatRow: studentsTable.seatRow,
          seatNumber: studentsTable.seatNumber,
          fullName: studentsTable.fullName,
        })
        .from(studentsTable)
        .where(
          and(
            eq(studentsTable.isActive, true),
            eq(studentsTable.seatRow, student.seatRow!),
            inArray(
              studentsTable.seatNumber,
              besides.map((seat) => seat.number),
            ),
          ),
        )
        .orderBy(asc(studentsTable.seatNumber))
    : [];

  const occupiedSeats = await db
    .select({
      seatRow: studentsTable.seatRow,
      seatNumber: studentsTable.seatNumber,
    })
    .from(studentsTable)
    .where(
      and(eq(studentsTable.isActive, true), isNotNull(studentsTable.seatRow)),
    )
    .orderBy(asc(studentsTable.seatRow), asc(studentsTable.seatNumber));

  // Seats come in complete pairs (a database check), so neither half is null here.
  return {
    ...student,
    neighbours: neighbours as {
      seatRow: string;
      seatNumber: number;
      fullName: string;
    }[],
    occupiedSeats: occupiedSeats as { seatRow: string; seatNumber: number }[],
    events,
  };
}
