import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const STAFF_ROLES = ["admin", "super"] as const;

/**
 * People who sign in to scan. Accounts are created and changed with SQL (see
 * docs/admin-sql.md); the app never edits this table. Passwords are stored as
 * bcrypt hashes made by pgcrypto: `crypt('the password', gen_salt('bf'))`.
 */
export const staffTable = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: STAFF_ROLES }).notNull().default("admin"),
    // Deactivate instead of deleting: check-ins keep pointing at the person.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Usernames are unique regardless of case; login ignores case too.
    uniqueIndex("staff_username_lower_key").on(sql`lower(${t.username})`),
    check("staff_username_check", sql`btrim(${t.username}) <> ''`),
    check(
      "staff_role_check",
      sql`${t.role} in (${sql.raw(STAFF_ROLES.map((r) => `'${r}'`).join(", "))})`,
    ),
  ],
);
