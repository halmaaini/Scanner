import { describe, expect, it } from "vitest";
import {
  HALL_COLUMNS,
  HALL_ROWS,
  findSeat,
  marchOrder,
  neighbourSeats,
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

describe("marchOrder", () => {
  it("walks the front row first, the far end of each row first", () => {
    expect(
      marchOrder("left")
        .slice(0, 3)
        .map((s) => `${s.row}${s.number}`),
    ).toEqual(["A1", "A2", "A3"]);
    expect(
      marchOrder("right")
        .slice(0, 3)
        .map((s) => `${s.row}${s.number}`),
    ).toEqual(["A18", "A17", "A16"]);
    expect(marchOrder("right").at(-1)).toMatchObject({ row: "R", number: 10 });
  });

  it("covers every seat on its side exactly once", () => {
    const all = HALL_ROWS.flatMap((row) => seatsInRow(row));
    for (const side of ["left", "right"] as const) {
      expect(marchOrder(side)).toHaveLength(
        all.filter((s) => s.side === side).length,
      );
    }
  });
});

describe("neighbourSeats", () => {
  it("gives the seats either side within the block", () => {
    expect(neighbourSeats("F", 7).map((s) => s.number)).toEqual([6, 8]);
  });

  it("does not reach across the aisle, and an end seat has one neighbour", () => {
    expect(neighbourSeats("A", 9).map((s) => s.number)).toEqual([8]);
    expect(neighbourSeats("A", 10).map((s) => s.number)).toEqual([11]);
    expect(neighbourSeats("F", 4).map((s) => s.number)).toEqual([3]);
    expect(neighbourSeats("Z", 1)).toEqual([]);
  });
});
