import type { Staff } from "@workspace/api-zod";
import type { Request, RequestHandler } from "express";
import { SESSION_COOKIE_NAME } from "../config";
import { HttpError } from "../lib/http";
import { findActiveStaff } from "../services/auth";

/**
 * Guards staff routes. The session only remembers *which* account signed in;
 * the account is loaded again on every request, so deactivating someone with
 * SQL (`is_active = false`) or changing their role takes effect immediately.
 */
export const requireStaff: RequestHandler = async (req, res, next) => {
  const staffId = req.session.staffId;
  const staff = staffId === undefined ? null : await findActiveStaff(staffId);

  if (!staff) {
    if (staffId !== undefined) {
      // The account was deactivated or deleted: end the stale session.
      await new Promise<void>((resolve) =>
        req.session.destroy(() => resolve()),
      );
      res.clearCookie(SESSION_COOKIE_NAME);
    }
    throw new HttpError(401, "Not signed in");
  }

  req.staff = staff;
  next();
};

/** The signed-in staff member; only call from a route behind `requireStaff`. */
export function staffOf(req: Request): Staff {
  if (!req.staff) throw new Error("staffOf() used outside requireStaff");
  return req.staff;
}
