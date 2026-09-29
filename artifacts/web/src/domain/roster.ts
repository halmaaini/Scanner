import type {
  Event,
  Registration,
  Roster,
  StaffRef,
  Student,
} from "@workspace/api-client-react";

export type { Event, Registration, Roster, StaffRef, Student };

const rowKey = (studentId: string, eventId: string) =>
  `${eventId}\u0000${studentId}`;

/** Fast lookups over a roster; build once per roster, not per lookup. */
export interface RosterIndex {
  eventById: ReadonlyMap<string, Event>;
  studentById: ReadonlyMap<string, Student>;
  staffById: ReadonlyMap<number, StaffRef>;
  registration(studentId: string, eventId: string): Registration | undefined;
}

export function indexRoster(roster: Roster): RosterIndex {
  const eventById = new Map(roster.events.map((e) => [e.id, e]));
  const studentById = new Map(roster.students.map((s) => [s.studentId, s]));
  const staffById = new Map(roster.staff.map((s) => [s.id, s]));
  const registrations = new Map(
    roster.registrations.map((r) => [rowKey(r.studentId, r.eventId), r]),
  );
  return {
    eventById,
    studentById,
    staffById,
    registration: (studentId, eventId) =>
      registrations.get(rowKey(studentId, eventId)),
  };
}

/** A registration with the given fields swapped in, in place of the old row. */
export function replaceRegistrations(
  roster: Roster,
  updates: readonly Registration[],
): Roster {
  if (updates.length === 0) return roster;
  const byKey = new Map(
    updates.map((r) => [rowKey(r.studentId, r.eventId), r]),
  );
  return {
    ...roster,
    registrations: roster.registrations.map(
      (r) => byKey.get(rowKey(r.studentId, r.eventId)) ?? r,
    ),
  };
}
