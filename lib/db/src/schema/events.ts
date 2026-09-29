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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("events_id_check", sql`${t.id} ~ '^[a-z0-9][a-z0-9_-]*$'`),
    check("events_name_check", sql`btrim(${t.name}) <> ''`),
  ],
);
