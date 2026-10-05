import type { StaffRole } from "@workspace/api-zod";

/**
 * Things only some roles may do. Scanning itself needs no permission: every
 * signed-in staff member can scan. Adding a role to the API spec makes this
 * file fail to compile until the new role is listed here.
 */
export type Permission = "view_report" | "manage_events" | "undo_any_check_in";

const GRANTS: Record<StaffRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>(["view_report"]),
  super: new Set<Permission>([
    "view_report",
    "manage_events",
    "undo_any_check_in",
  ]),
};

export function can(role: StaffRole, permission: Permission): boolean {
  return GRANTS[role].has(permission);
}

/** Admins may undo check-ins they made; anyone with `undo_any_check_in` may undo any. */
export function canUndoCheckIn(
  staff: { id: number; role: StaffRole },
  registration: { checkedInBy: number | null },
): boolean {
  return (
    can(staff.role, "undo_any_check_in") ||
    registration.checkedInBy === staff.id
  );
}
