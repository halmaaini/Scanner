import { describe, expect, it } from "vitest";
import { PROCESSION } from "@/config";
import { buildProcession, placeInLine, pointAt, routeTo } from "./procession";

const seat = (row: string, number: number) => ({
  seatRow: row,
  seatNumber: number,
});
const fullHall = () =>
  "ABCDEFGHIJKLMNOPQR"
    .split("")
    .flatMap((row) => Array.from({ length: 18 }, (_, i) => seat(row, i + 1)));

describe("buildProcession", () => {
  it("seats a full hall in about the set time, then holds and tosses the caps", () => {
    const p = buildProcession(fullHall(), seat("F", 7));
    expect(p.walkers).toHaveLength(252);
    expect(p.seatedAt).toBeGreaterThan(
      PROCESSION.secs - PROCESSION.holdSecs - 1,
    );
    expect(p.seatedAt).toBeLessThanOrEqual(
      PROCESSION.secs - PROCESSION.holdSecs + 0.01,
    );
    expect(p.tossAt).toBeCloseTo(p.seatedAt + PROCESSION.holdSecs);
    expect(p.end).toBeCloseTo(p.tossAt + PROCESSION.tossSecs);
    expect(p.mine?.seat).toMatchObject({ row: "F", number: 7 });
  });

  it("only walks to seats someone holds, and always includes the student", () => {
    const p = buildProcession([seat("A", 1), seat("Q", 12)], seat("B", 4));
    expect(
      p.walkers.map((w) => `${w.seat.row}${w.seat.number}`).sort(),
    ).toEqual(["A1", "B4", "Q12"]);
  });

  it("sends the front row first and lets nobody overtake the one ahead", () => {
    const p = buildProcession(fullHall(), seat("F", 7));
    const right = p.walkers.filter((w) => w.seat.side === "right");
    expect(right[0]!.seat).toMatchObject({ row: "A", number: 18 });
    for (let i = 1; i < right.length; i++) {
      expect(right[i]!.start).toBeGreaterThan(right[i - 1]!.start);
    }
  });
});

describe("routeTo", () => {
  it("starts behind the stage and ends on the seat", () => {
    const r = routeTo({ row: "F", number: 7, side: "right", column: 16 });
    expect(pointAt(r, 0).y).toBeGreaterThan(785);
    const end = pointAt(r, r.length);
    expect(end.x).toBeCloseTo(361 + 15 * 16 + 18 + 7);
  });
});

describe("placeInLine", () => {
  it("counts the student's place among the people actually in their line", () => {
    expect(placeInLine(fullHall(), seat("A", 18))).toEqual({
      place: 1,
      of: 126,
      side: "right",
    });
    // Two people ahead in the front row on that side.
    expect(
      placeInLine([seat("A", 18), seat("A", 17), seat("B", 1)], seat("B", 18)),
    ).toEqual({ place: 3, of: 3, side: "right" });
  });

  it("knows nothing about a seat the hall does not have", () => {
    expect(placeInLine([], seat("Z", 1))).toBeUndefined();
  });
});
