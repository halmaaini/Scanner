import { describe, expect, it } from "vitest";
import { foldName, resolveTypedId, studentMatcher } from "./search";
import { makeRoster } from "./testing";

describe("foldName", () => {
  it("ignores case and Latin accents", () => {
    expect(foldName("José ÁLVAREZ")).toBe(foldName("jose alvarez"));
  });

  it("ignores Arabic spelling variants and vowel marks", () => {
    expect(foldName("أحمد")).toBe(foldName("احمد"));
    expect(foldName("إبراهيم")).toBe(foldName("ابراهيم"));
    expect(foldName("فاطمة")).toBe(foldName("فاطمه"));
    expect(foldName("مصطفى")).toBe(foldName("مصطفي"));
    expect(foldName("مُحَمَّد")).toBe(foldName("محمد"));
  });
});

describe("foldName spacing", () => {
  it("ignores extra spaces between and around words", () => {
    expect(foldName("  Layla   Hassan ")).toBe("layla hassan");
  });
});

const students = [
  ...makeRoster().students,
  { studentId: "S0000001234", fullName: "Nour Saleh", isActive: true },
  { studentId: "S00000012345", fullName: "Omar Haddad", isActive: true },
];

describe("studentMatcher", () => {
  it("points at nobody for a blank query", () => {
    expect(studentMatcher("   ")).toBeUndefined();
  });

  it("finds part of an ID, in any letter case", () => {
    const matches = studentMatcher("1234")!;
    expect(students.filter(matches).map((s) => s.studentId)).toEqual([
      "S0000001234",
      "S00000012345",
    ]);
    expect(students.filter(studentMatcher("s000000123")!)).toHaveLength(2);
  });

  it("reads Arabic digits and finds names despite spelling variants", () => {
    expect(students.filter(studentMatcher("١٠٠٢")!)[0]?.studentId).toBe("1002");
    expect(students.filter(studentMatcher("layla   hassan")!)).toHaveLength(1);
    const arabic = [
      { studentId: "9", fullName: "أحمد الفاطمي", isActive: true },
    ];
    expect(arabic.filter(studentMatcher("احمد")!)).toHaveLength(1);
  });
});

describe("resolveTypedId", () => {
  it("takes a whole ID as it is, in any letter case, even when a longer one contains it", () => {
    expect(resolveTypedId(students, "S0000001234", 8)).toEqual({
      kind: "exact",
      studentId: "S0000001234",
    });
    expect(resolveTypedId(students, " s0000001234 ", 8)).toEqual({
      kind: "exact",
      studentId: "S0000001234",
    });
  });

  it("offers a choice for part of an ID instead of guessing", () => {
    const result = resolveTypedId(students, "1234", 8);
    expect(result.kind).toBe("choose");
    if (result.kind === "choose") {
      expect(result.candidates.map((s) => s.studentId)).toEqual([
        "S0000001234",
        "S00000012345",
      ]);
      expect(result.total).toBe(2);
    }
  });

  it("offers a choice even for a single partial match, and cuts a long list", () => {
    const one = resolveTypedId(students, "003", 8);
    expect(one).toMatchObject({ kind: "choose", total: 1 });
    const many = resolveTypedId(students, "10", 2);
    expect(many).toMatchObject({ kind: "choose", total: 3 });
    if (many.kind === "choose") expect(many.candidates).toHaveLength(2);
  });

  it("says none when nobody matches or nothing was typed", () => {
    expect(resolveTypedId(students, "99999", 8)).toEqual({ kind: "none" });
    expect(resolveTypedId(students, "   ", 8)).toEqual({ kind: "none" });
  });
});
