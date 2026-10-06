import {
  HALL_AISLE_AFTER,
  HALL_COLUMNS,
  HALL_ROWS,
  type HallSeat,
} from "@workspace/attendance";

/**
 * Where everything sits on the plan. The picture of the audience seating
 * (hall-audience.webp) is the base, so all positions are in its pixels; the
 * student block is laid over the floor in the middle of it.
 */
export const PLAN_W = 1029;
export const PLAN_H = 838;

export const PITCH = 16;
export const CELL = 14;
export const AISLE = 18;
/** Left edge and top of the student block. */
export const X0 = 361;
export const Y0 = 410;

export const BLOCK_W = HALL_COLUMNS * PITCH + AISLE;
const POOL_ROWS = ["K", "D"] as const;

export const colX = (column: number) =>
  X0 + (column - 1) * PITCH + (column > HALL_AISLE_AFTER ? AISLE : 0);
export const rowY = (row: string) => Y0 + HALL_ROWS.indexOf(row) * PITCH;

export const seatBox = (seat: HallSeat) => ({
  x: colX(seat.column),
  y: rowY(seat.row),
});

/** The pool fills the notch the middle rows leave between the two blocks. */
export const POOL = {
  cx: X0 + BLOCK_W / 2,
  cy: (rowY(POOL_ROWS[0]) + rowY(POOL_ROWS[1]) + CELL) / 2,
  r: 56,
};

/** The student floor, as a drawn outline, and the box views may not leave when zoomed in. */
export const FLOOR_PATH =
  "M340,440 Q340,380 400,380 L630,380 Q690,380 690,440 L690,690 Q690,730 745,758 L795,785 L235,785 L285,758 Q340,730 340,690 Z";
export const FLOOR = { x1: 340, x2: 690, y1: 380, y2: 740 };
export const STAGE = { x: 235, y: 785, w: 560, h: 41 };

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECT = (PLAN_W - 20) / PLAN_H;
/** The whole picture, without the dark strip along its edges. */
export const WHOLE: View = { x: 8, y: 0, w: PLAN_W - 20, h: PLAN_H };
/** Closest the view may get: a few seats fill the screen. */
export const MIN_W = 110;
/** Zoomed in enough for a seat to be a comfortable touch target. */
export const TAP_W = 200;

export const viewOf = (cx: number, cy: number, w: number): View => ({
  x: cx - w / 2,
  y: cy - w / ASPECT / 2,
  w,
  h: w / ASPECT,
});

/** A view kept inside the picture, and inside the floor once it is zoomed in. */
export function clampView(v: View): View {
  const w = Math.min(Math.max(v.w, MIN_W), WHOLE.w);
  const h = w / ASPECT;
  const zoomedIn = w < TAP_W * 1.6;
  const box = zoomedIn
    ? {
        x1: FLOOR.x1 - 10,
        x2: FLOOR.x2 + 10,
        y1: FLOOR.y1 - 10,
        y2: FLOOR.y2 + 20,
      }
    : { x1: WHOLE.x, x2: WHOLE.x + WHOLE.w, y1: 0, y2: PLAN_H };
  const x = Math.min(Math.max(v.x, box.x1), Math.max(box.x2 - w, box.x1));
  const y = Math.min(Math.max(v.y, box.y1), Math.max(box.y2 - h, box.y1));
  return { x, y, w, h };
}

/** A comfortable close-up of one seat. */
export function viewOfSeat(seat: HallSeat): View {
  const box = seatBox(seat);
  return clampView(viewOf(box.x + CELL / 2, box.y + CELL / 2, 235));
}

/** The whole student floor. */
export const AREA: View = clampView(
  viewOf((FLOOR.x1 + FLOOR.x2) / 2, (FLOOR.y1 + FLOOR.y2) / 2, 440),
);
