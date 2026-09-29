import { normalizeStudentId } from "@workspace/attendance";
import type { Event, Roster, Student } from "./roster";

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

export interface StudentAttendance {
  student: Student;
  /** One entry per event the student is registered for, in event order. */
  events: { event: Event; checkedInAt: string | null }[];
}

export interface SearchResult {
  matches: StudentAttendance[];
  /** How many students matched in all (matches may be cut to `limit`). */
  total: number;
}

/** Students whose ID contains the query or whose name contains it (spelling-tolerant). */
export function searchStudents(
  roster: Roster,
  query: string,
  limit: number,
): SearchResult {
  const trimmed = query.trim();
  if (!trimmed) return { matches: [], total: 0 };

  const idQuery = normalizeStudentId(trimmed).toLowerCase();
  const nameQuery = foldName(trimmed);

  const found = roster.students.filter(
    (s) =>
      (idQuery !== "" && s.studentId.toLowerCase().includes(idQuery)) ||
      foldName(s.fullName).includes(nameQuery),
  );
  const shown = new Set(found.slice(0, limit).map((s) => s.studentId));

  const eventOrder = new Map(roster.events.map((e, i) => [e.id, i]));
  const eventById = new Map(roster.events.map((e) => [e.id, e]));
  const perStudent = new Map<string, StudentAttendance["events"]>();
  for (const r of roster.registrations) {
    const event = eventById.get(r.eventId);
    if (!event || !shown.has(r.studentId)) continue;
    const list = perStudent.get(r.studentId) ?? [];
    list.push({ event, checkedInAt: r.checkedInAt });
    perStudent.set(r.studentId, list);
  }

  return {
    total: found.length,
    matches: found.slice(0, limit).map((student) => ({
      student,
      events: (perStudent.get(student.studentId) ?? []).sort(
        (a, b) =>
          (eventOrder.get(a.event.id) ?? 0) - (eventOrder.get(b.event.id) ?? 0),
      ),
    })),
  };
}
