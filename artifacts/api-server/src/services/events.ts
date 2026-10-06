import type { Event, EventChange } from "@workspace/api-zod";
import { db, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { eventColumns } from "./columns";

/** Empty text means "nothing here": it is stored as null, as the database requires. */
const blankToNull = (text: string | null) => text?.trim() || null;

/** Changes only the fields given. Setting what an event already has changes nothing. */
export async function updateEvent(
  staffId: number,
  eventId: string,
  change: EventChange,
): Promise<Event> {
  const { isOpen, startsAt, venue, mapUrl, hasSeating } = change;
  const changes = {
    ...(isOpen !== undefined && { isOpen }),
    ...(hasSeating !== undefined && { hasSeating }),
    ...(startsAt !== undefined && {
      startsAt: startsAt === null ? null : new Date(startsAt),
    }),
    ...(venue !== undefined && { venue: blankToNull(venue) }),
    ...(mapUrl !== undefined && { mapUrl: blankToNull(mapUrl) }),
  };
  const where = eq(eventsTable.id, eventId);
  // An update with nothing to set is not valid SQL; there is nothing to change anyway.
  const [event] =
    Object.keys(changes).length === 0
      ? await db.select(eventColumns).from(eventsTable).where(where)
      : await db
          .update(eventsTable)
          .set(changes)
          .where(where)
          .returning(eventColumns);
  if (!event) throw new HttpError(404, "Event not found");

  logger.info(
    { staffId, eventId, fields: Object.keys(change) },
    "event changed",
  );
  return event;
}
