import type { Registration, Roster } from "./roster";

/** A registration row; pass a time and a staff id to make it a check-in. */
export function reg(
  studentId: string,
  eventId: string,
  checkedInAt: string | null = null,
  checkedInBy: number | null = null,
): Registration {
  return { studentId, eventId, checkedInAt, checkedInBy };
}

/**
 * A small roster used across the tests: two events, three students (one
 * revoked) and two staff, with a few check-ins already made.
 */
export function makeRoster(overrides: Partial<Roster> = {}): Roster {
  return {
    events: [
      { id: "rehearsal", name: "Rehearsal", sortOrder: 1, isOpen: false },
      { id: "graduation", name: "Graduation", sortOrder: 2, isOpen: true },
    ],
    students: [
      { studentId: "1001", fullName: "Layla Hassan", isActive: true },
      { studentId: "1002", fullName: "Yusuf Ibrahim", isActive: true },
      { studentId: "1003", fullName: "Karim Nasser", isActive: false },
    ],
    registrations: [
      reg("1001", "rehearsal", "2026-06-11T09:14:00.000Z", 2),
      reg("1001", "graduation"),
      reg("1002", "rehearsal"),
      reg("1002", "graduation"),
      reg("1003", "graduation", "2026-06-12T09:00:00.000Z", 3),
    ],
    staff: [
      { id: 2, displayName: "Sara" },
      { id: 3, displayName: "Omar" },
    ],
    ...overrides,
  };
}
