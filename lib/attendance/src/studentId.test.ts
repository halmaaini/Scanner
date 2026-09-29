import { describe, expect, it } from "vitest";
import {
  MAX_STUDENT_ID_LENGTH,
  STUDENT_ID_FORBIDDEN_PATTERN,
  normalizeStudentId,
} from "./studentId";

const char = String.fromCodePoint;
const NO_BREAK_SPACE = char(0x00a0);
const RIGHT_TO_LEFT_MARK = char(0x200f);
const LEFT_TO_RIGHT_MARK = char(0x200e);
const ZERO_WIDTH_SPACE = char(0x200b);

/** Every code point of the Basic Multilingual Plane except the surrogate halves. */
function* basicMultilingualPlane(): Generator<string> {
  for (let code = 1; code <= 0xffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    yield char(code);
  }
}

describe("normalizeStudentId", () => {
  it("leaves a clean ID untouched, including letters, case and hyphens", () => {
    expect(normalizeStudentId("2021-04517")).toBe("2021-04517");
    expect(normalizeStudentId("Ab12-x")).toBe("Ab12-x");
    expect(normalizeStudentId("CS/2021/045")).toBe("CS/2021/045");
  });

  it("removes surrounding and inner whitespace", () => {
    expect(normalizeStudentId("  2021 04517\n")).toBe("202104517");
    expect(normalizeStudentId(`2021${NO_BREAK_SPACE}04517`)).toBe("202104517");
  });

  it("converts Arabic-Indic digits", () => {
    const digits = Array.from({ length: 10 }, (_, d) => char(0x0660 + d));
    expect(normalizeStudentId(digits.join(""))).toBe("0123456789");
  });

  it("converts Persian digits", () => {
    const digits = Array.from({ length: 10 }, (_, d) => char(0x06f0 + d));
    expect(normalizeStudentId(digits.join(""))).toBe("0123456789");
  });

  it("folds full-width characters", () => {
    expect(normalizeStudentId(char(0xff12, 0xff10, 0xff12, 0xff11))).toBe(
      "2021",
    );
  });

  it("drops invisible direction and zero-width marks", () => {
    expect(
      normalizeStudentId(
        `${RIGHT_TO_LEFT_MARK}2021${LEFT_TO_RIGHT_MARK}04517${ZERO_WIDTH_SPACE}`,
      ),
    ).toBe("202104517");
    expect(normalizeStudentId(`${char(0xfeff)}2021`)).toBe("2021");
  });

  it("drops the Arabic letter mark, soft hyphen and word joiner", () => {
    const noisy = `2021${char(0x061c)}04${char(0x00ad)}517${char(0x2060)}`;
    expect(normalizeStudentId(noisy)).toBe("202104517");
  });

  it("drops control characters, including NUL", () => {
    expect(
      normalizeStudentId(`20${char(0)}21${char(0x1f)}04${char(0x7f)}5`),
    ).toBe("2021045");
    expect(normalizeStudentId(`2021${char(0x0085)}${char(0x009f)}`)).toBe(
      "2021",
    );
  });

  it("drops variation selectors and the other invisible fillers", () => {
    const noisy = `2021${char(0xfe0f)}04${char(0x034f)}${char(0x3164)}517`;
    expect(normalizeStudentId(noisy)).toBe("202104517");
  });

  // The list of dropped characters is written out (the browser, the server and
  // the database must all use the same one), so this is what notices a
  // character the Unicode standard has since made invisible.
  it("drops every control character, space and invisible mark of the Basic Multilingual Plane", () => {
    const invisible = /[\p{Cc}\p{Z}\p{Default_Ignorable_Code_Point}]/u;
    const kept: string[] = [];
    for (let code = 0; code <= 0xffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const c = char(code);
      if (invisible.test(c) && normalizeStudentId(`A${c}1`) !== "A1") {
        kept.push(`U+${code.toString(16).padStart(4, "0")}`);
      }
    }
    expect(kept).toEqual([]);
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeStudentId("   \t")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeStudentId(
      ` ${char(0x0662)}${char(0x0660)}21 045${RIGHT_TO_LEFT_MARK}17 `,
    );
    expect(normalizeStudentId(once)).toBe(once);
  });

  it("is idempotent even when removing a mark lets an accent join its letter", () => {
    const once = normalizeStudentId(`A${ZERO_WIDTH_SPACE}${char(0x0301)}`);
    expect(once).toBe(char(0x00c1));
    expect(normalizeStudentId(once)).toBe(once);
  });
});

describe("STUDENT_ID_FORBIDDEN_PATTERN", () => {
  const forbidden = new RegExp(STUDENT_ID_FORBIDDEN_PATTERN);

  it("does not match the characters real IDs are made of", () => {
    for (const ok of [
      "0123456789",
      "abcXYZ",
      "-_./#",
      char(0x0627, 0x0628, 0x062c),
    ]) {
      expect(forbidden.test(ok)).toBe(false);
    }
  });

  // The database stores an ID only if it contains no forbidden character and is
  // already NFKC-normalised. That must be exactly "normalizeStudentId leaves it
  // alone", for every character the scanner could meet.
  it("with NFKC, describes exactly the IDs that normalizeStudentId leaves alone", () => {
    const wrong: string[] = [];
    for (const c of basicMultilingualPlane()) {
      const id = `A${c}1`;
      const stored = !forbidden.test(id) && id.normalize("NFKC") === id;
      if ((normalizeStudentId(id) === id) !== stored) {
        wrong.push(`U+${c.codePointAt(0)?.toString(16).padStart(4, "0")}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("leaves nothing forbidden in a normalised ID", () => {
    for (const c of basicMultilingualPlane()) {
      expect(forbidden.test(normalizeStudentId(`A${c}1`))).toBe(false);
    }
  });
});

describe("MAX_STUDENT_ID_LENGTH", () => {
  it("is a positive whole number", () => {
    expect(Number.isInteger(MAX_STUDENT_ID_LENGTH)).toBe(true);
    expect(MAX_STUDENT_ID_LENGTH).toBeGreaterThan(0);
  });
});
