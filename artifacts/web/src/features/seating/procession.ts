import {
  findSeat,
  marchOrder,
  type HallSeat,
  type HallSide,
} from "@workspace/attendance";
import { PROCESSION } from "@/config";
import { CELL, LANES, POOL, colX, rowY } from "./geometry";

export interface Point {
  x: number;
  y: number;
}

export interface Route {
  points: Point[];
  /** Distance along the route at each point. */
  lengths: number[];
  length: number;
}

export interface Walker {
  seat: HallSeat;
  route: Route;
  /** Seconds from the start: when they appear from behind the stage, and when they sit. */
  start: number;
  arrive: number;
  mine: boolean;
}

export interface Procession {
  walkers: Walker[];
  mine: Walker | undefined;
  /** Everyone is seated. */
  seatedAt: number;
  /** The caps go up (after the close-up on the student's seat has settled). */
  tossAt: number;
  end: number;
}

export interface SeatPosition {
  seatRow: string;
  seatNumber: number;
}

export const seatCenter = (seat: HallSeat): Point => ({
  x: colX(seat.column) + CELL / 2,
  y: rowY(seat.row) + CELL / 2,
});

/** The aisle lane at height `y`, bending round the pool where the two would meet. */
function laneX(side: HallSide, y: number): number {
  const base = LANES.aisle[side];
  const r = POOL.r + LANES.poolGap;
  const dy = y - POOL.cy;
  if (Math.abs(dy) >= r) return base;
  const dx = Math.sqrt(r * r - dy * dy);
  return side === "right"
    ? Math.max(base, POOL.cx + dx)
    : Math.min(base, POOL.cx - dx);
}

/** Rounds the corners of a path (Chaikin), keeping both ends where they are. */
function smooth(points: Point[], passes: number): Point[] {
  let out = points;
  for (let k = 0; k < passes; k++) {
    const next: Point[] = [out[0]!];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i]!;
      const b = out[i + 1]!;
      next.push(
        { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 },
        { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 },
      );
    }
    next.push(out[out.length - 1]!);
    out = next;
  }
  return out;
}

/** Behind the stage, up the side of the floor, across the top, down the aisle, along the row. */
export function routeTo(seat: HallSeat): Route {
  const side = seat.side;
  const target = seatCenter(seat);
  const raw: Point[] = [
    LANES.start[side],
    { x: LANES.outer[side], y: LANES.turn },
    { x: LANES.outer[side], y: LANES.top },
    { x: LANES.aisle[side], y: LANES.top },
  ];
  for (let y = LANES.top + 5; y < target.y; y += 5) {
    raw.push({ x: laneX(side, y), y });
  }
  raw.push({ x: laneX(side, target.y), y: target.y }, target);

  const points = smooth(raw, 3);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, lengths, length: lengths[lengths.length - 1]! };
}

/** The point `distance` along a route. */
export function pointAt(route: Route, distance: number): Point {
  const { points, lengths } = route;
  if (distance <= 0) return points[0]!;
  if (distance >= route.length) return points[points.length - 1]!;
  let lo = 0;
  let hi = lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid]! < distance) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  const f = (distance - lengths[lo]!) / (lengths[hi]! - lengths[lo]! || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

const key = (row: string, number: number) => `${row}${number}`;

/** Each side's line: the marching order, keeping only seats someone holds. */
function lines(taken: readonly SeatPosition[]): Record<HallSide, HallSeat[]> {
  const held = new Set(taken.map((s) => key(s.seatRow, s.seatNumber)));
  const line = (side: HallSide) =>
    marchOrder(side).filter((seat) => held.has(key(seat.row, seat.number)));
  return { left: line("left"), right: line("right") };
}

/** Where the student walks in their line ("40th of 126 on Stage Right"). */
export function placeInLine(
  taken: readonly SeatPosition[],
  mine: SeatPosition,
): { place: number; of: number; side: HallSide } | undefined {
  const seat = findSeat(mine.seatRow, mine.seatNumber);
  if (!seat) return undefined;
  const line = lines([...taken, mine])[seat.side];
  const index = line.findIndex(
    (s) => s.row === seat.row && s.number === seat.number,
  );
  return { place: index + 1, of: line.length, side: seat.side };
}

/**
 * The whole procession: one graduate to every seat someone holds, both lines
 * at once, spaced so that everyone is seated after about `secs` whatever the
 * number of graduates.
 */
export function buildProcession(
  taken: readonly SeatPosition[],
  mine: SeatPosition,
  timing: typeof PROCESSION = PROCESSION,
): Procession {
  const both = lines([...taken, mine]);
  const routes = new Map<HallSeat, Route>();
  for (const seat of [...both.left, ...both.right]) {
    routes.set(seat, routeTo(seat));
  }

  // The widest spacing at which everyone (not only the last in line) is seated in time.
  const seatedBy = timing.secs - timing.holdSecs;
  let gap = Infinity;
  for (const side of ["left", "right"] as const) {
    both[side].forEach((seat, index) => {
      if (index > 0) {
        const walk = routes.get(seat)!.length / timing.speed;
        gap = Math.min(gap, (seatedBy - walk) / index);
      }
    });
  }
  gap = Number.isFinite(gap) ? Math.max(0.05, gap) : 0;

  const walkers: Walker[] = (["left", "right"] as const).flatMap((side) =>
    both[side].map((seat, index) => {
      const route = routes.get(seat)!;
      const start = index * gap;
      return {
        seat,
        route,
        start,
        arrive: start + route.length / timing.speed,
        mine: seat.row === mine.seatRow && seat.number === mine.seatNumber,
      };
    }),
  );
  const seatedAt = Math.max(0, ...walkers.map((w) => w.arrive));
  const tossAt = seatedAt + timing.holdSecs;
  return {
    walkers,
    mine: walkers.find((w) => w.mine),
    seatedAt,
    tossAt,
    end: tossAt + timing.tossSecs,
  };
}
