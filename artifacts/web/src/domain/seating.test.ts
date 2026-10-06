import { describe, expect, it } from "vitest";
import { seatDirections, seatingView, studentSeat } from "./seating";
import { makeRoster, reg } from "./testing";

const seated = (
  studentId: string,
  seatRow: string | null,
  seatNumber: number | null,
) => ({ seatRow, seatNumber, studentId });

function rosterWithSeats() {
  const base = makeRoster();
  return makeRoster({
    students: base.students.map((s) => ({
      ...s,
      ...(s.studentId === "1001" && seated("1001", "F", 7)),
      ...(s.studentId === "1002" && seated("1002", "F", 99)),
    })),
    registrations: [
      reg("1001", "graduation", "2026-06-12T09:00:00.000Z", 2),
      reg("1002", "graduation"),
      reg("1003", "graduation"),
    ],
  });
}

describe("studentSeat", () => {
  it("finds a real seat, and nothing for a missing or impossible one", () => {
    expect(studentSeat({ seatRow: "F", seatNumber: 7 })).toMatchObject({
      row: "F",
      number: 7,
      side: "right",
    });
    expect(studentSeat({ seatRow: "F", seatNumber: 99 })).toBeUndefined();
    expect(studentSeat({ seatRow: null, seatNumber: null })).toBeUndefined();
    expect(studentSeat({})).toBeUndefined();
  });
});

describe("seatingView", () => {
  it("marks who is in and who is still to come, and lists the gaps in the data", () => {
    const view = seatingView(rosterWithSeats(), "graduation");

    expect(view.bySeat.get("F7")?.mark).toBe("present");
    expect(view.present).toBe(1);
    expect(view.expected).toBe(0);
    // 1002 holds a seat the hall does not have; 1003 has none at all.
    expect(view.offPlan.map((s) => s.studentId)).toEqual(["1002"]);
    expect(view.noSeat.map((s) => s.studentId)).toEqual(["1003"]);
  });

  it("only looks at the event asked for", () => {
    const view = seatingView(rosterWithSeats(), "rehearsal");
    expect(view.bySeat.size).toBe(0);
    expect(view.noSeat).toEqual([]);
  });

  it("marks a revoked student as revoked, even if they checked in earlier", () => {
    const roster = rosterWithSeats();
    roster.students = roster.students.map((s) =>
      s.studentId === "1001" ? { ...s, isActive: false } : s,
    );
    const view = seatingView(roster, "graduation");
    expect(view.bySeat.get("F7")?.mark).toBe("revoked");
    expect(view.present).toBe(0);
  });
});

describe("seatDirections", () => {
  it("counts rows back from the front and says which block", () => {
    expect(
      seatDirections({ row: "F", number: 7, side: "right", column: 16 }),
    ).toEqual({ rowsBack: 5, side: "right", seatsInRow: 9 });
    expect(
      seatDirections({ row: "A", number: 1, side: "left", column: 1 }),
    ).toMatchObject({ rowsBack: 0, seatsInRow: 18 });
  });
});
