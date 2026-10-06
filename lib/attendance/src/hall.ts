/**
 * The seating plan of the hall, defined once. The web app draws it from this,
 * and checks every student's seat against it; the database only checks what it
 * can without knowing the layout (a row letter, a number, nobody sharing a seat).
 *
 * Rows run from the front (A, next to the stage) to the back (R). Seats are
 * numbered from the left edge across the row. Each row has a left and a right
 * block, split by the aisle; the middle rows leave a gap for the pool.
 */

/** Row letters from the back of the hall to the front, the order they are drawn. */
export const HALL_ROWS = "RQPONMLKJIHGFEDCBA".split("");

/** Rows that are only set up when the numbers need them. */
export const HALL_EXTRA_ROWS: readonly string[] = ["R", "Q", "P", "O"];

/** The widest row has this many seat positions; the aisle falls after `HALL_AISLE_AFTER`. */
export const HALL_COLUMNS = 18;
export const HALL_AISLE_AFTER = 9;

/** The database refuses a seat number above this (`students_seat_check`). */
export const MAX_SEAT_NUMBER = 99;

export type HallSide = "left" | "right";

export interface HallSeat {
  row: string;
  number: number;
  side: HallSide;
  /** 1-based position across the widest row, so seats line up between rows. */
  column: number;
}

interface Block {
  /** Column of the block's first seat. */
  column: number;
  seats: number;
  firstNumber: number;
}

const FULL = {
  left: { column: 1, seats: 9, firstNumber: 1 },
  right: { column: 10, seats: 9, firstNumber: 10 },
} satisfies Record<HallSide, Block>;

/** Rows that are not full width: the two blocks shrink around the pool. */
const SHAPED: Record<string, Record<HallSide, Block>> = {
  K: {
    left: { column: 2, seats: 5, firstNumber: 1 },
    right: { column: 13, seats: 5, firstNumber: 6 },
  },
  J: {
    left: { column: 1, seats: 5, firstNumber: 1 },
    right: { column: 15, seats: 4, firstNumber: 6 },
  },
  I: {
    left: { column: 1, seats: 4, firstNumber: 1 },
    right: { column: 15, seats: 4, firstNumber: 5 },
  },
  H: {
    left: { column: 1, seats: 4, firstNumber: 1 },
    right: { column: 15, seats: 4, firstNumber: 5 },
  },
  G: {
    left: { column: 1, seats: 4, firstNumber: 1 },
    right: { column: 15, seats: 4, firstNumber: 5 },
  },
  F: {
    left: { column: 1, seats: 4, firstNumber: 1 },
    right: { column: 14, seats: 5, firstNumber: 5 },
  },
  E: {
    left: { column: 1, seats: 5, firstNumber: 1 },
    right: { column: 14, seats: 5, firstNumber: 6 },
  },
  D: {
    left: { column: 1, seats: 5, firstNumber: 1 },
    right: { column: 14, seats: 5, firstNumber: 6 },
  },
};

/** Every seat of a row, left to right; empty for a row the hall does not have. */
export function seatsInRow(row: string): HallSeat[] {
  if (!HALL_ROWS.includes(row)) return [];
  const blocks = SHAPED[row] ?? FULL;
  return (["left", "right"] as const).flatMap((side) =>
    Array.from({ length: blocks[side].seats }, (_, i) => ({
      row,
      number: blocks[side].firstNumber + i,
      side,
      column: blocks[side].column + i,
    })),
  );
}

/** The seat at this row and number, or undefined when the hall has none there. */
export function findSeat(row: string, number: number): HallSeat | undefined {
  return seatsInRow(row).find((seat) => seat.number === number);
}

/** "F7": how a seat is written in a search box. */
export const seatLabel = (row: string, number: number) => `${row}${number}`;

/**
 * Reads a seat typed by a person ("f7", "F 7", "F-7"). Null when the text is
 * not a row letter followed by a number; it does not check the hall has that seat.
 */
export function parseSeat(
  text: string,
): { row: string; number: number } | null {
  const match = /^([a-z])[\s-]*(\d{1,2})$/i.exec(text.trim());
  if (!match) return null;
  return { row: match[1]!.toUpperCase(), number: Number(match[2]) };
}
