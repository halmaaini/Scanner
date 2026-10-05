import { indexRoster, type Event, type Roster } from "./roster";

export interface EventSummary {
  event: Event;
  /** Registered students whose access is not revoked. */
  expected: number;
  /** Of those, how many have checked in. */
  checkedIn: number;
}

/**
 * The one place attendance is counted, so the scanner header and the report
 * can never disagree. Revoked students are left out of both numbers: they are
 * not expected, and the ratio can never pass 100%.
 */
export function summarizeEvents(roster: Roster): EventSummary[] {
  const active = new Set(
    roster.students.filter((s) => s.isActive).map((s) => s.studentId),
  );
  const totals = new Map(
    roster.events.map((event) => [event.id, { expected: 0, checkedIn: 0 }]),
  );

  for (const r of roster.registrations) {
    const total = totals.get(r.eventId);
    if (!total || !active.has(r.studentId)) continue;
    total.expected += 1;
    if (r.checkedInAt) total.checkedIn += 1;
  }

  return roster.events.map((event) => ({
    event,
    ...(totals.get(event.id) ?? { expected: 0, checkedIn: 0 }),
  }));
}

export function summaryFor(
  summaries: readonly EventSummary[],
  eventId: string | undefined,
): EventSummary | undefined {
  return summaries.find((s) => s.event.id === eventId);
}
