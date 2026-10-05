import type { Event } from "@workspace/api-zod";
import { db, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { eventColumns } from "./columns";

/** Opens or closes an event. Setting the state it already has changes nothing. */
export async function setEventOpen(
  staffId: number,
  eventId: string,
  isOpen: boolean,
): Promise<Event> {
  const [event] = await db
    .update(eventsTable)
    .set({ isOpen })
    .where(eq(eventsTable.id, eventId))
    .returning(eventColumns);
  if (!event) throw new HttpError(404, "Event not found");

  logger.info({ staffId, eventId, isOpen }, "event switched");
  return event;
}
