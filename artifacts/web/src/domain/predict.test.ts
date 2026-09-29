import { describe, expect, it } from "vitest";
import { predictScan } from "./predict";
import { makeRoster } from "./testing";

const at = "2026-06-12T10:42:00.000Z";
const predict = (studentId: string, eventId: string, staffId = 2) =>
  predictScan(makeRoster(), {
    id: "scan-1",
    studentId,
    eventId,
    scannedAt: at,
    staffId,
  });

describe("predictScan", () => {
  it("predicts a check-in with the time and person that would be recorded", () => {
    expect(predict("1002", "graduation", 3)).toEqual({
      id: "scan-1",
      outcome: "checked_in",
      studentId: "1002",
      eventId: "graduation",
      student: { studentId: "1002", fullName: "Yusuf Ibrahim", isActive: true },
      registration: {
        studentId: "1002",
        eventId: "graduation",
        checkedInAt: at,
        checkedInBy: 3,
      },
    });
  });

  it("predicts a repeat, quoting the earlier check-in", () => {
    const result = predict("1001", "rehearsal");
    expect(result.outcome).toBe("already_checked_in");
    expect(result.registration).toEqual({
      studentId: "1001",
      eventId: "rehearsal",
      checkedInAt: "2026-06-11T09:14:00.000Z",
      checkedInBy: 2,
    });
  });

  it("predicts refusals with no registration", () => {
    expect(predict("1003", "graduation")).toMatchObject({
      outcome: "revoked",
      registration: null,
    });
    expect(predict("1001", "nope")).toMatchObject({ outcome: "unknown_event" });
    expect(predict("9999", "graduation")).toMatchObject({
      outcome: "unknown_student",
      student: null,
      registration: null,
    });
  });

  it("predicts not_registered for a student who is not on the event's list", () => {
    const roster = makeRoster({
      registrations: makeRoster().registrations.filter(
        (r) => !(r.studentId === "1002" && r.eventId === "graduation"),
      ),
    });
    const result = predictScan(roster, {
      id: "x",
      studentId: "1002",
      eventId: "graduation",
      scannedAt: at,
      staffId: 2,
    });
    expect(result.outcome).toBe("not_registered");
  });
});
