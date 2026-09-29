import { describe, expect, it } from "vitest";
import { buildAttendanceCsv } from "./export";
import { makeRoster } from "./testing";

describe("buildAttendanceCsv", () => {
  it("writes one row per registration with attendance, time, scanner and access", () => {
    const lines = buildAttendanceCsv(makeRoster()).trimEnd().split("\r\n");
    expect(lines).toEqual([
      "student_id,name,event,attended,checked_in_at,checked_in_at_utc,checked_in_by,access",
      "1001,Layla Hassan,Rehearsal,yes,2026-06-11 09:14:00,2026-06-11T09:14:00.000Z,Sara,active",
      "1002,Yusuf Ibrahim,Rehearsal,no,,,,active",
      "1001,Layla Hassan,Graduation,no,,,,active",
      "1002,Yusuf Ibrahim,Graduation,no,,,,active",
      "1003,Karim Nasser,Graduation,yes,2026-06-12 09:00:00,2026-06-12T09:00:00.000Z,Omar,revoked",
    ]);
  });

  it("quotes names that contain commas or quotes", () => {
    const roster = makeRoster({
      students: [
        { studentId: "1", fullName: 'Hassan, "Abu" Layla', isActive: true },
      ],
      registrations: [
        {
          studentId: "1",
          eventId: "graduation",
          checkedInAt: null,
          checkedInBy: null,
        },
      ],
    });
    expect(buildAttendanceCsv(roster)).toContain('"Hassan, ""Abu"" Layla"');
  });

  it("neutralises spreadsheet formulas in imported text", () => {
    const roster = makeRoster({
      students: [
        { studentId: "1", fullName: '=HYPERLINK("http://x")', isActive: true },
      ],
      registrations: [
        {
          studentId: "1",
          eventId: "graduation",
          checkedInAt: null,
          checkedInBy: null,
        },
      ],
    });
    expect(buildAttendanceCsv(roster)).toContain("'=HYPERLINK");
  });
});
