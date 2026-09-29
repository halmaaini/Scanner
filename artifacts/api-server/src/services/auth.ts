import type { Staff } from "@workspace/api-zod";
import { db, staffTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { TIMING_DUMMY_HASH } from "../config";

const staffColumns = {
  id: staffTable.id,
  username: staffTable.username,
  displayName: staffTable.displayName,
  role: staffTable.role,
};

/**
 * Checks a username and password. Passwords are verified inside Postgres with
 * pgcrypto (`hash = crypt(password, hash)`), the same function that created
 * the hash when the account was added with SQL, so there is one scheme and it
 * lives in one place.
 *
 * Returns null for an unknown user, a wrong password or a deactivated account;
 * callers must not say which.
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<Staff | null> {
  const [row] = await db
    .select({
      ...staffColumns,
      isActive: staffTable.isActive,
      passwordOk: sql<boolean>`${staffTable.passwordHash} = crypt(${password}, ${staffTable.passwordHash})`,
    })
    .from(staffTable)
    .where(sql`lower(${staffTable.username}) = lower(${username.trim()})`)
    .limit(1);

  if (!row) {
    // Spend the same time as a real check so an unknown username is not faster.
    await db.execute(sql`select crypt(${password}, ${TIMING_DUMMY_HASH})`);
    return null;
  }
  if (!row.passwordOk || !row.isActive) return null;

  const { isActive: _isActive, passwordOk: _passwordOk, ...staff } = row;
  return staff;
}

/** The staff member behind a session, or null if gone or deactivated. */
export async function findActiveStaff(id: number): Promise<Staff | null> {
  const [row] = await db
    .select(staffColumns)
    .from(staffTable)
    .where(and(eq(staffTable.id, id), eq(staffTable.isActive, true)))
    .limit(1);
  return row ?? null;
}
