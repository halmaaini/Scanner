import { normalizeStudentId, parseSeat } from "@workspace/attendance";
import type { Student } from "./roster";

/**
 * Makes names comparable for searching: case, accents, runs of spaces and
 * Arabic spelling variants (أ/إ/آ vs ا, ة vs ه, ى vs ي, vowel marks) no longer matter.
 */
export function foldName(text: string): string {
  return text
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064a");
}

/**
 * Whether what a person typed points at this student: part of the ID in any
 * letter case ("1234" finds "S0000001234"), part of the name (spelling
 * tolerant), or their seat ("F7"). Undefined for a blank query, which points
 * at nobody.
 */
export function studentMatcher(
  query: string,
): ((student: Student) => boolean) | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  const idQuery = normalizeStudentId(trimmed).toLowerCase();
  const nameQuery = foldName(trimmed);
  const seat = parseSeat(trimmed);
  return (student) =>
    (idQuery !== "" && student.studentId.toLowerCase().includes(idQuery)) ||
    foldName(student.fullName).includes(nameQuery) ||
    (seat !== null &&
      student.seatRow === seat.row &&
      student.seatNumber === seat.number);
}

/** What typing something at the scanner leads to. */
export type TypedId =
  /** The ID of exactly one student: scan it. */
  | { kind: "exact"; studentId: string }
  /** Several or inexact matches: let the person choose, never guess. */
  | { kind: "choose"; candidates: Student[]; total: number }
  /** Nobody matches: scan it as typed and let the answer say so. */
  | { kind: "none" };

/**
 * An ID typed in full (any letter case) is taken as it is, even when longer
 * IDs contain it; anything else is matched loosely and offered as a choice.
 */
export function resolveTypedId(
  students: readonly Student[],
  raw: string,
  limit: number,
): TypedId {
  const id = normalizeStudentId(raw);
  if (!id) return { kind: "none" };

  const exact =
    students.find((s) => s.studentId === id) ??
    students.find((s) => s.studentId.toLowerCase() === id.toLowerCase());
  if (exact) return { kind: "exact", studentId: exact.studentId };

  const matches = studentMatcher(raw);
  const found = matches ? students.filter(matches) : [];
  if (found.length === 0) return { kind: "none" };
  return {
    kind: "choose",
    candidates: found.slice(0, limit),
    total: found.length,
  };
}
