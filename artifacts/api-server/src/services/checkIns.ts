import type { Registration, Staff } from "@workspace/api-zod";
import { canUndoCheckIn, normalizeStudentId } from "@workspace/attendance";
import { db, registrationsTable } from "@workspace/db";
import { and, sql } from "drizzle-orm";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { registrationColumns, registrationKey } from "./columns";

/**
 * Clears a check-in and leaves the student registered. Undoing something
 * already clear succeeds without changing anything, so a retry is harmless.
 */
export async function undoCheckIn(
  staff: Staff,
  eventId: string,
  rawStudentId: string,
): Promise<Registration> {
  const studentId = normalizeStudentId(rawStudentId);
  const here = registrationKey(studentId, eventId);

  const [registration] = await db
    .select(registrationColumns)
    .from(registrationsTable)
    .where(here);
  if (!registration) throw new HttpError(404, "Registration not found");
  if (!registration.checkedInAt) return registration;
  if (!canUndoCheckIn(staff, registration)) {
    throw new HttpError(403, "You can only undo check-ins you made");
  }

  // Only clear the check-in we just authorised against: if it was undone and
  // redone by someone else in the meantime, leave the newer one alone.
  const [cleared] = await db
    .update(registrationsTable)
    .set({ checkedInAt: null, checkedInBy: null })
    .where(
      and(
        here,
        sql`${registrationsTable.checkedInBy} is not distinct from ${registration.checkedInBy}`,
      ),
    )
    .returning(registrationColumns);

  if (cleared) {
    logger.info({ staffId: staff.id, studentId, eventId }, "check-in undone");
    return cleared;
  }

  const [current] = await db
    .select(registrationColumns)
    .from(registrationsTable)
    .where(here);
  return current ?? registration;
}
