import {
  MAX_EVENT_ID_LENGTH,
  MAX_MAP_URL_LENGTH,
  MAX_VENUE_LENGTH,
} from "@workspace/attendance";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Things people check in to (rehearsal, graduation, trophy handover, ...).
 * `id` is a short slug used in URLs and SQL. Scanners only offer events where
 * `is_open` is true; the server still accepts scans for any existing event so
 * a scan made offline before an event was closed is never lost.
 */
export const eventsTable = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isOpen: boolean("is_open").notNull().default(false),
    // What attendees see on their card; all optional.
    startsAt: timestamp("starts_at", { withTimezone: true }),
    venue: text("venue"),
    mapUrl: text("map_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "events_id_check",
      sql`char_length(${t.id}) <= ${sql.raw(String(MAX_EVENT_ID_LENGTH))} and ${t.id} ~ '^[a-z0-9][a-z0-9_-]*$'`,
    ),
    check("events_name_check", sql`btrim(${t.name}) <> ''`),
    check(
      "events_venue_check",
      sql`${t.venue} is null or (btrim(${t.venue}) <> '' and char_length(${t.venue}) <= ${sql.raw(String(MAX_VENUE_LENGTH))})`,
    ),
    // Only web links: the card shows it as a link people tap.
    check(
      "events_map_url_check",
      sql`${t.mapUrl} is null or (${t.mapUrl} ~ '^https?://[^[:space:]]+$' and char_length(${t.mapUrl}) <= ${sql.raw(String(MAX_MAP_URL_LENGTH))})`,
    ),
  ],
);
