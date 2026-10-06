import { describe, expect, it } from "vitest";
import {
  HALL_COLUMNS,
  HALL_ROWS,
  findSeat,
  parseSeat,
  seatsInRow,
} from "./hall";

describe("the hall", () => {
  it("has the seat counts of the plan, row by row", () => {
    const counts = Object.fromEntries(
      HALL_ROWS.map((row) => [row, seatsInRow(row).length]),
    );
    expect(counts).toEqual({
      R: 18,
      Q: 18,
      P: 18,
      O: 18,
      N: 18,
      M: 18,
      L: 18,
      K: 10,
      J: 9,
      I: 8,
      H: 8,
      G: 8,
      F: 9,
      E: 10,
      D: 10,
      C: 18,
      B: 18,
      A: 18,
    });
  });

  it("numbers every row 1..n with no gaps or repeats, and keeps seats inside the columns", () => {
    for (const row of HALL_ROWS) {
      const seats = seatsInRow(row);
      expect(seats.map((s) => s.number)).toEqual(seats.map((_, i) => i + 1));
      const columns = seats.map((s) => s.column);
      expect(new Set(columns).size).toBe(columns.length);
      expect(Math.min(...columns)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...columns)).toBeLessThanOrEqual(HALL_COLUMNS);
    }
  });

  it("puts seat 1..9 of a full row on the left and the rest on the right", () => {
    expect(findSeat("A", 9)?.side).toBe("left");
    expect(findSeat("A", 10)?.side).toBe("right");
    expect(findSeat("F", 4)).toMatchObject({ side: "left", column: 4 });
    expect(findSeat("F", 5)).toMatchObject({ side: "right", column: 14 });
  });

  it("knows which seats do not exist", () => {
    expect(findSeat("F", 10)).toBeUndefined();
    expect(findSeat("Z", 1)).toBeUndefined();
    expect(findSeat("A", 0)).toBeUndefined();
    expect(seatsInRow("")).toEqual([]);
  });
});

describe("parseSeat", () => {
  it("reads a seat written the ways people write it", () => {
    for (const text of ["f7", "F7", " F 7 ", "F-7"]) {
      expect(parseSeat(text)).toEqual({ row: "F", number: 7 });
    }
  });

  it("refuses anything else", () => {
    for (const text of ["", "F", "7", "FF7", "F7x", "layla"]) {
      expect(parseSeat(text)).toBeNull();
    }
  });
});
