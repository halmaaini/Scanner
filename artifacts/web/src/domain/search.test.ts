import { describe, expect, it } from "vitest";
import { foldName, searchStudents } from "./search";
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

describe("searchStudents", () => {
  const roster = makeRoster();

  it("returns nothing for a blank query", () => {
    expect(searchStudents(roster, "   ", 10)).toEqual({
      matches: [],
      total: 0,
    });
  });

  it("matches part of a name, ignoring case", () => {
    const { matches, total } = searchStudents(roster, "layla", 10);
    expect(total).toBe(1);
    expect(matches[0]?.student.studentId).toBe("1001");
  });

  it("matches part of an ID, also typed with Arabic digits", () => {
    expect(
      searchStudents(roster, "1002", 10).matches[0]?.student.fullName,
    ).toBe("Yusuf Ibrahim");
    expect(
      searchStudents(roster, "١٠٠٢", 10).matches[0]?.student.studentId,
    ).toBe("1002");
    expect(searchStudents(roster, "100", 10).total).toBe(3);
  });

  it("shows each match's events in event order with their check-in state", () => {
    const [layla] = searchStudents(roster, "layla", 10).matches;
    expect(layla?.events.map((e) => [e.event.id, e.checkedInAt])).toEqual([
      ["rehearsal", "2026-06-11T09:14:00.000Z"],
      ["graduation", null],
    ]);
  });

  it("cuts to the limit but reports the full count", () => {
    const result = searchStudents(roster, "100", 2);
    expect(result.matches).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it("finds Arabic names however they are spelled", () => {
    const arabic = makeRoster({
      students: [
        { studentId: "2001", fullName: "أحمد الفاطمي", isActive: true },
      ],
      registrations: [],
    });
    expect(searchStudents(arabic, "احمد", 10).total).toBe(1);
  });

  it("finds an ID whatever its letter case", () => {
    const lettered = makeRoster({
      students: [
        { studentId: "CS/2021/045", fullName: "Nour Saleh", isActive: true },
      ],
      registrations: [],
    });
    expect(searchStudents(lettered, "cs/2021", 10).total).toBe(1);
    expect(searchStudents(lettered, "CS/2021/045", 10).total).toBe(1);
  });

  it("finds a name typed with different spacing", () => {
    expect(searchStudents(roster, "layla   hassan", 10).total).toBe(1);
    expect(searchStudents(roster, " layla hassan ", 10).total).toBe(1);
  });
});
