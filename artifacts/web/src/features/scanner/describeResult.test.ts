import type { ScanResult } from "@workspace/api-client-react";
import { describe, expect, it } from "vitest";
import { m } from "@/messages";
import { describeResult } from "./describeResult";

const student = { studentId: "1001", fullName: "Layla Hassan", isActive: true };
const registration = {
  studentId: "1001",
  eventId: "graduation",
  checkedInAt: "2026-06-12T10:42:00.000Z",
  checkedInBy: 3,
};

const result = (overrides: Partial<ScanResult>): ScanResult => ({
  id: "scan-1",
  outcome: "checked_in",
  studentId: "1001",
  eventId: "graduation",
  student,
  registration,
  ...overrides,
});

const describeIt = (r: ScanResult, offline = false) =>
  describeResult({
    result: r,
    offline,
    eventName: "Graduation ceremony",
    staffName: (id) => (id === 3 ? "Omar" : undefined),
  });

describe("describeResult", () => {
  it("shows a check-in in green with the event and the time", () => {
    const d = describeIt(result({}));
    expect(d).toMatchObject({
      tone: "ok",
      title: "Checked in",
      name: "Layla Hassan",
      idLine: "Student ID 1001",
    });
    expect(d.rows.map((r) => r.label)).toEqual(["Event", "Time"]);
    expect(d.rows[0]?.value).toBe("Graduation ceremony");
    expect(d.note).toBeUndefined();
  });

  it("shows a repeat in amber with who scanned first", () => {
    const d = describeIt(result({ outcome: "already_checked_in" }));
    expect(d).toMatchObject({
      tone: "warn",
      note: m.results.alreadyCheckedIn.note,
    });
    expect(d.rows.map((r) => r.label)).toEqual([
      "Event",
      "First scan",
      "Scanned by",
    ]);
    expect(d.rows.at(-1)?.value).toBe("Omar");
  });

  it("does not guess when the person who scanned is unknown", () => {
    const d = describeIt(
      result({
        outcome: "already_checked_in",
        registration: { ...registration, checkedInBy: 99 },
      }),
    );
    expect(d.rows.at(-1)?.value).toBe(m.results.someoneElse);
  });

  it("shows every refusal in red with advice", () => {
    for (const outcome of [
      "revoked",
      "not_registered",
      "unknown_student",
      "unknown_event",
    ] as const) {
      const d = describeIt(result({ outcome, registration: null }));
      expect(d.tone).toBe("bad");
      expect(d.note).toBeTruthy();
    }
  });

  it("gives the reason for a revoked or unregistered student", () => {
    expect(
      describeIt(result({ outcome: "revoked", registration: null })).rows[0],
    ).toEqual({
      label: "Reason",
      value: "Access revoked",
      emphasis: true,
    });
    expect(
      describeIt(result({ outcome: "not_registered", registration: null }))
        .rows[0]?.value,
    ).toBe("Not registered for this event");
  });

  it("shows the typed ID when the student is unknown", () => {
    const d = describeIt(
      result({ outcome: "unknown_student", student: null, registration: null }),
    );
    expect(d).toMatchObject({
      name: "Unknown ID",
      idLine: "Student ID 1001",
      rows: [],
    });
  });

  it("marks answers that came from the saved list, worded by what was found", () => {
    expect(describeIt(result({}), true).offlineNote).toBe(
      m.results.offline.saved,
    );
    expect(
      describeIt(
        result({
          outcome: "unknown_student",
          student: null,
          registration: null,
        }),
        true,
      ).offlineNote,
    ).toBe(m.results.offline.listMayBeOld);
    expect(
      describeIt(result({ outcome: "revoked", registration: null }), true)
        .offlineNote,
    ).toBe(m.results.offline.checkedAgainstList);
    expect(describeIt(result({}), false).offlineNote).toBeUndefined();
  });

  it("tells the staff member where the student sits", () => {
    const d = describeIt(
      result({ student: { ...student, seatRow: "F", seatNumber: 7 } }),
    );
    expect(d.rows.find((r) => r.label === "Seat")?.value).toBe(
      "F7, Stage Right",
    );
  });

  it("shows no seat line when none is assigned", () => {
    expect(describeIt(result({})).rows.map((r) => r.label)).not.toContain(
      "Seat",
    );
  });
});
