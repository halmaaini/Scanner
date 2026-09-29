import type { ScanOutcome } from "@workspace/api-zod";

/**
 * Most scans one request may carry. Small enough that the server answers well
 * inside a scanner's timeout even on a slow database; a scanner with a longer
 * backlog simply sends several requests. The API spec's `maxItems` must match;
 * a server test checks it.
 */
export const MAX_SCANS_PER_REQUEST = 100;

/** What is known about a scan at the moment it is judged. */
export interface ScanFacts {
  /** The event being scanned for; null/undefined if there is no such event. */
  event: { id: string } | null | undefined;
  /** The student behind the scanned ID; null/undefined if the ID is unknown. */
  student: { isActive: boolean } | null | undefined;
  /** The student's place on this event's list; null/undefined if not on it. */
  registration: { checkedInAt: Date | string | null } | null | undefined;
}

/**
 * The single rule set for judging a scan. The server uses it to decide what
 * to record; a scanner that is offline uses the same function on its saved
 * copy of the data, so both always give the same answer for the same facts.
 *
 * Order matters: the first rule that applies wins.
 */
export function evaluateScan(facts: ScanFacts): ScanOutcome {
  if (!facts.event) return "unknown_event";
  if (!facts.student) return "unknown_student";
  if (!facts.student.isActive) return "revoked";
  if (!facts.registration) return "not_registered";
  if (facts.registration.checkedInAt) return "already_checked_in";
  return "checked_in";
}
