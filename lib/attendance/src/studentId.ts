/**
 * Longest student ID the API accepts. Anything longer cannot be a student ID
 * (a stray QR code, say), so scanners answer "unknown" without asking the
 * server. The API spec's `maxLength` must match; a server test checks it.
 */
export const MAX_STUDENT_ID_LENGTH = 64;

/**
 * Turns whatever was scanned or typed into the form stored in
 * `students.student_id`. The server and the web app both call this, so an ID
 * means the same thing everywhere (QR code, manual entry, card link).
 *
 * - Arabic-Indic and Persian digits become 0-9 (an Arabic keyboard types them).
 * - Full-width and other compatibility forms are folded (NFKC).
 * - Whitespace and invisible direction marks are removed: IDs never contain
 *   them, but they sneak in when an ID is pasted or copied from Arabic text.
 *
 * Letters, case and punctuation are left alone.
 */
export function normalizeStudentId(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
}
