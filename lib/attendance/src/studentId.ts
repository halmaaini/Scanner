/**
 * Longest student ID the API accepts. Anything longer cannot be a student ID
 * (a stray QR code, say), so scanners answer "unknown" without asking the
 * server. The API spec's `maxLength` must match; a server test checks it, and
 * the database refuses longer IDs too.
 */
export const MAX_STUDENT_ID_LENGTH = 64;

/** First and last code point of a run of characters (both included). */
type CodePointRange = readonly [first: number, last: number];

/**
 * Characters that never belong in an ID and are dropped when one is typed,
 * scanned or pasted: whitespace, and the invisible marks (zero-width and
 * direction marks, soft hyphen) that come along when an ID is copied from
 * Arabic text or a spreadsheet.
 */
const IGNORED: readonly CodePointRange[] = [
  [0x0009, 0x000d], // tab, line feed, vertical tab, form feed, carriage return
  [0x0020, 0x0020], // space
  [0x0085, 0x0085], // next line
  [0x00a0, 0x00a0], // no-break space
  [0x00ad, 0x00ad], // soft hyphen
  [0x061c, 0x061c], // Arabic letter mark
  [0x1680, 0x1680], // Ogham space mark
  [0x180e, 0x180e], // Mongolian vowel separator
  [0x2000, 0x200f], // en/em/thin/... spaces, zero-width space and joiners, left/right marks
  [0x2028, 0x202f], // line and paragraph separators, direction embeddings/overrides, narrow no-break space
  [0x205f, 0x206f], // medium mathematical space, word joiner, invisible operators, direction isolates
  [0x3000, 0x3000], // ideographic space
  [0xfeff, 0xfeff], // zero-width no-break space (byte-order mark)
];

/**
 * The zero of each script whose ten digits are read as 0-9 (an Arabic keyboard
 * types them): Arabic-Indic and Persian.
 */
const OTHER_DIGIT_ZEROS = [0x0660, 0x06f0] as const;

const OTHER_DIGITS: readonly CodePointRange[] = OTHER_DIGIT_ZEROS.map(
  (zero) => [zero, zero + 9] as const,
);

/** Written as \uXXXX so the same text is a valid regular expression in JavaScript and in PostgreSQL. */
const escapeCodePoint = (codePoint: number) =>
  `\\u${codePoint.toString(16).padStart(4, "0")}`;

const characterClass = (ranges: readonly CodePointRange[]) =>
  `[${ranges
    .map(([first, last]) =>
      first === last
        ? escapeCodePoint(first)
        : `${escapeCodePoint(first)}-${escapeCodePoint(last)}`,
    )
    .join("")}]`;

/**
 * Every character `normalizeStudentId` removes or rewrites, as a regular
 * expression that means the same in JavaScript and in PostgreSQL. The database
 * builds its student ID check from it, so it cannot store an ID that the
 * scanner (which normalizes what it reads) could never match.
 */
export const STUDENT_ID_FORBIDDEN_PATTERN = characterClass([
  ...IGNORED,
  ...OTHER_DIGITS,
]);

const ignored = new RegExp(characterClass(IGNORED), "g");
const otherDigits = new RegExp(characterClass(OTHER_DIGITS), "g");

const digitValues = new Map<string, string>(
  OTHER_DIGIT_ZEROS.flatMap((zero) =>
    Array.from({ length: 10 }, (_, digit) => [
      String.fromCharCode(zero + digit),
      String(digit),
    ]),
  ),
);

/**
 * Turns whatever was scanned or typed into the form stored in
 * `students.student_id`. The server and the web app both call this, so an ID
 * means the same thing everywhere (QR code, manual entry, card link).
 *
 * - Arabic-Indic and Persian digits become 0-9.
 * - Full-width and other compatibility forms are folded (NFKC).
 * - Whitespace and invisible direction marks are removed: IDs never contain
 *   them, but they sneak in when an ID is pasted or copied from Arabic text.
 *
 * Letters, case and punctuation are left alone. The result is a fixed point
 * (normalizing it again changes nothing); the database only stores IDs that
 * already are one.
 */
export function normalizeStudentId(raw: string): string {
  return (
    raw
      .normalize("NFKC")
      .replace(otherDigits, (digit) => digitValues.get(digit) ?? digit)
      .replace(ignored, "")
      // Dropping a mark can leave a letter and its accent side by side; fold once more.
      .normalize("NFKC")
  );
}
