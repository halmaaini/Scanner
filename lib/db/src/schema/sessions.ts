import { index, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Login sessions, managed entirely by connect-pg-simple. The column names and
 * types are the ones that library expects; do not rename them.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => [index("sessions_expire_idx").on(t.expire)],
);
