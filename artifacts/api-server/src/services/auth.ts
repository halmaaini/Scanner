import type { Staff } from "@workspace/api-zod";
import { db, staffTable } from "@workspace/db";
import { compare } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { TIMING_DUMMY_HASH } from "../config";

const staffColumns = {
  id: staffTable.id,
  username: staffTable.username,
  displayName: staffTable.displayName,
  role: staffTable.role,
};

/**
 * Checks a username and password. The stored value is a bcrypt hash made by
 * pgcrypto (`crypt(password, gen_salt('bf', 10))`) when the account was added
 * with SQL. The comparison happens here, in the API, so the password is never
 * sent to the database: it cannot show up in query parameters, driver error
 * messages or database logs.
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
      passwordHash: staffTable.passwordHash,
    })
    .from(staffTable)
    .where(sql`lower(${staffTable.username}) = lower(${username.trim()})`)
    .limit(1);

  // Compare against a hash even when the username does not exist, so an
  // unknown username takes as long as a wrong password.
  const passwordOk = await compare(
    password,
    row?.passwordHash ?? TIMING_DUMMY_HASH,
  );
  if (!row || !passwordOk || !row.isActive) return null;

  const { isActive: _isActive, passwordHash: _passwordHash, ...staff } = row;
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
