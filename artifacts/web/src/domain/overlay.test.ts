import { describe, expect, it } from "vitest";
import type { PendingOp } from "./ops";
import { applyPendingOps } from "./overlay";
import { replaceRegistrations } from "./roster";
import { makeRoster, reg } from "./testing";

const scan = (studentId: string, eventId: string, staffId = 2): PendingOp => ({
  type: "scan",
  id: crypto.randomUUID(),
  studentId,
  eventId,
  scannedAt: "2026-06-12T10:42:00.000Z",
  staffId,
});
const undo = (studentId: string, eventId: string, staffId = 2): PendingOp => ({
  type: "undo",
  id: crypto.randomUUID(),
  studentId,
  eventId,
  staffId,
});

const rowOf = (roster: ReturnType<typeof makeRoster>, s: string, e: string) =>
  roster.registrations.find((r) => r.studentId === s && r.eventId === e);

describe("applyPendingOps", () => {
  it("returns the same roster when nothing is pending", () => {
    const roster = makeRoster();
    expect(applyPendingOps(roster, [])).toBe(roster);
  });

  it("shows a pending scan as a check-in by that person, without touching the input", () => {
    const roster = makeRoster();
    const view = applyPendingOps(roster, [scan("1002", "graduation", 3)]);
    expect(rowOf(view, "1002", "graduation")).toEqual(
      reg("1002", "graduation", "2026-06-12T10:42:00.000Z", 3),
    );
    expect(rowOf(roster, "1002", "graduation")?.checkedInAt).toBeNull();
  });

  it("leaves an existing check-in alone (first scan wins)", () => {
    const view = applyPendingOps(makeRoster(), [scan("1001", "rehearsal", 3)]);
    expect(rowOf(view, "1001", "rehearsal")).toEqual(
      reg("1001", "rehearsal", "2026-06-11T09:14:00.000Z", 2),
    );
  });

  it("shows a pending undo as no check-in", () => {
    const view = applyPendingOps(makeRoster(), [undo("1001", "rehearsal")]);
    expect(rowOf(view, "1001", "rehearsal")).toEqual(reg("1001", "rehearsal"));
  });

  it("applies operations in order: scan then undo cancels out, undo then scan re-checks in", () => {
    const roster = makeRoster();
    const scanned = applyPendingOps(roster, [
      scan("1002", "graduation"),
      undo("1002", "graduation"),
    ]);
    expect(rowOf(scanned, "1002", "graduation")?.checkedInAt).toBeNull();

    const redone = applyPendingOps(roster, [
      undo("1001", "rehearsal"),
      scan("1001", "rehearsal", 3),
    ]);
    expect(rowOf(redone, "1001", "rehearsal")).toEqual(
      reg("1001", "rehearsal", "2026-06-12T10:42:00.000Z", 3),
    );
  });

  it("ignores operations for registrations that do not exist", () => {
    const roster = makeRoster();
    const view = applyPendingOps(roster, [
      scan("9999", "graduation"),
      undo("1002", "nope"),
    ]);
    expect(view.registrations).toEqual(roster.registrations);
  });

  it("keeps the order of registrations", () => {
    const roster = makeRoster();
    const view = applyPendingOps(roster, [scan("1002", "rehearsal")]);
    expect(
      view.registrations.map((r) => `${r.studentId}/${r.eventId}`),
    ).toEqual(roster.registrations.map((r) => `${r.studentId}/${r.eventId}`));
  });
});

describe("replaceRegistrations", () => {
  it("swaps in server rows by student and event", () => {
    const roster = makeRoster();
    const updated = replaceRegistrations(roster, [
      reg("1002", "graduation", "2026-06-12T11:00:00.000Z", 3),
    ]);
    expect(rowOf(updated, "1002", "graduation")?.checkedInBy).toBe(3);
    expect(updated.registrations).toHaveLength(roster.registrations.length);
  });

  it("returns the same roster for no updates", () => {
    const roster = makeRoster();
    expect(replaceRegistrations(roster, [])).toBe(roster);
  });
});
