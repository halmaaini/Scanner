import {
  HALL_EXTRA_ROWS,
  HALL_ROWS,
  seatLabel,
  seatsInRow,
  type HallSeat,
} from "@workspace/attendance";
import { Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import audience from "@/assets/hall-audience.webp";
import { cn } from "@/lib/cn";
import { m } from "@/messages";
import type { SeatMark } from "@/domain/seating";
import {
  AREA,
  BLOCK_W,
  CELL,
  FLOOR_PATH,
  MIN_W,
  PLAN_H,
  PLAN_W,
  POOL,
  STAGE,
  TAP_W,
  WHOLE,
  X0,
  clampView,
  colX,
  rowY,
  seatBox,
  viewOf,
  viewOfSeat,
  type View,
} from "./geometry";

export interface SeatRef {
  row: string;
  number: number;
}

interface HallPlanProps {
  /** Colours the seats of students by how they stand (the staff view). */
  marks?: ReadonlyMap<string, SeatMark>;
  /** The viewer's own seat, drawn gold and pulsing (the student's card). */
  mine?: SeatRef;
  selected?: SeatRef | null;
  /** Called when a seat is touched while zoomed in far enough to hit it. */
  onSeatClick?: (seat: SeatRef) => void;
  /** Where the view starts, before any zooming. */
  start: "seat" | "area" | "all";
  /** Label for the shortcut that goes to the seat or the student area. */
  closeUpLabel: string;
  description: string;
}

const MARK_STYLES: Record<SeatMark, { rect: string; text: string }> = {
  present: { rect: "fill-ok", text: "fill-white" },
  expected: { rect: "fill-warn-soft stroke-warn", text: "fill-ink" },
  revoked: { rect: "fill-bad-soft stroke-bad", text: "fill-bad" },
};

const seatKeyOf = (seat: SeatRef) => seatLabel(seat.row, seat.number);
const sameSeat = (a?: SeatRef | null, b?: SeatRef | null) =>
  !!a && !!b && a.row === b.row && a.number === b.number;

/**
 * The hall: the audience picture greyed out behind, the student rows on the
 * floor in front. Drag to move, +/− or a tap to zoom; a seat can be touched
 * once the view is close enough for it to be a fair target.
 */
export function HallPlan({
  marks,
  mine,
  selected,
  onSeatClick,
  start,
  closeUpLabel,
  description,
}: HallPlanProps) {
  const [view, setViewState] = useState<View>(WHOLE);
  const viewRef = useRef(view);
  // Where the view is heading, so quick taps on +/− add up instead of restarting.
  const goalRef = useRef(view);
  const frame = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointer: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);
  const jumpTo = useCallback(
    (next: View) => {
      goalRef.current = next;
      setView(next);
    },
    [setView],
  );

  const goTo = useCallback(
    (target: View) => {
      cancelAnimationFrame(frame.current);
      const to = clampView(target);
      goalRef.current = to;
      const from = viewRef.current;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setView(to);
        return;
      }
      let t0: number | null = null;
      const step = (now: number) => {
        t0 ??= now;
        const p = Math.min((now - t0) / 900, 1);
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        setView({
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          w: from.w + (to.w - from.w) * e,
          h: from.h + (to.h - from.h) * e,
        });
        if (p < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [setView],
  );

  const mineKey = mine ? seatKeyOf(mine) : "";
  const closeUp = useCallback(() => {
    if (mine) {
      const seat = seatsInRow(mine.row).find((s) => s.number === mine.number);
      if (seat) return viewOfSeat(seat);
    }
    return AREA;
    // The seat's identity is its key; the object may be a new one each render.
  }, [mineKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open on the whole hall, then settle on the close-up (the card's "arrival").
  useEffect(() => {
    if (start === "all") return;
    jumpTo(WHOLE);
    const timer = setTimeout(
      () => goTo(closeUp()),
      start === "seat" ? 1200 : 0,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [start, closeUp, goTo, jumpTo]);

  const zoomBy = (factor: number) => {
    const v = goalRef.current;
    goTo(viewOf(v.x + v.w / 2, v.y + v.h / 2, v.w / factor));
  };

  const toPlan = (clientX: number, clientY: number) => {
    const box = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: v.x + ((clientX - box.left) / box.width) * v.w,
      y: v.y + ((clientY - box.top) / box.height) * v.h,
    };
  };

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointer: event.pointerId,
    };
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) event.currentTarget.setPointerCapture(event.pointerId);
    d.moved = true;
    cancelAnimationFrame(frame.current);
    const box = event.currentTarget.getBoundingClientRect();
    const v = viewRef.current;
    jumpTo(
      clampView({
        ...v,
        x: v.x - (dx / box.width) * v.w,
        y: v.y - (dy / box.height) * v.h,
      }),
    );
    d.x = event.clientX;
    d.y = event.clientY;
  }
  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    // A short press is a tap; a drag ends here without one.
    window.setTimeout(() => {
      if (drag.current?.pointer === event.pointerId) drag.current = null;
    }, 0);
  }

  function onClick(event: React.MouseEvent<SVGSVGElement>) {
    if (drag.current?.moved) return;
    const v = viewRef.current;
    const target = (event.target as Element).closest<SVGElement>("[data-seat]");
    if (v.w > TAP_W) {
      // Too far out to hit a seat: a tap zooms in on that spot.
      const at = toPlan(event.clientX, event.clientY);
      goTo(viewOf(at.x, at.y, TAP_W * 0.7));
      return;
    }
    if (target && onSeatClick) {
      onSeatClick({
        row: target.dataset.row!,
        number: Number(target.dataset.number),
      });
    }
  }

  // The seats are drawn once per change of marks, not on every frame of a zoom.
  const seats = useMemo(() => {
    const interactive = !!onSeatClick;
    return HALL_ROWS.flatMap((row) =>
      seatsInRow(row).map((seat: HallSeat) => {
        const key = seatKeyOf(seat);
        const { x, y } = seatBox(seat);
        const isMine = mineKey === key;
        const mark = marks?.get(key);
        const style = mark ? MARK_STYLES[mark] : undefined;
        const isSelected = sameSeat(selected, seat);
        return (
          <g
            key={key}
            data-seat=""
            data-row={row}
            data-number={seat.number}
            role={interactive && mark ? "button" : undefined}
            tabIndex={interactive && mark ? 0 : undefined}
            aria-label={
              interactive && mark
                ? m.seating.seatLabel(row, seat.number)
                : undefined
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSeatClick?.({ row, number: seat.number });
              }
            }}
            className={cn(interactive && mark && "cursor-pointer")}
          >
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={3}
              className={cn(
                isMine
                  ? "fill-gold stroke-ink"
                  : (style?.rect ??
                      (HALL_EXTRA_ROWS.includes(row)
                        ? "fill-extra"
                        : "fill-seat")),
                marks && !mark && !isMine && "opacity-50",
              )}
              strokeWidth={isMine ? 2 : 1}
            />
            <text
              x={x + CELL / 2}
              y={y + CELL / 2 + 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn(
                "pointer-events-none font-semibold",
                isMine ? "fill-ink" : (style?.text ?? "fill-seat-ink"),
              )}
              fontSize={isMine ? 9 : 7.5}
            >
              {seat.number}
            </text>
            {isSelected && (
              <rect
                x={x - 2}
                y={y - 2}
                width={CELL + 4}
                height={CELL + 4}
                rx={5}
                fill="none"
                strokeWidth={2.5}
                className="stroke-ink"
              />
            )}
          </g>
        );
      }),
    );
  }, [marks, mineKey, selected, onSeatClick]);

  const mineSeat = mine
    ? seatsInRow(mine.row).find((s) => s.number === mine.number)
    : undefined;
  const mineBox = mineSeat ? seatBox(mineSeat) : undefined;
  // The audience fades away as the view closes in on the student floor.
  const audienceOpacity = Math.max(
    0,
    Math.min(1, (view.w - TAP_W) / (WHOLE.w - TAP_W)),
  );
  const zoomedIn = view.w <= TAP_W;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={m.seating.zoom}
          className="inline-flex overflow-hidden rounded-[10px] border-[1.5px] border-ink"
        >
          {(
            [
              [closeUpLabel, () => goTo(closeUp()), view.w <= 240],
              [m.seating.wholeHall, () => goTo(WHOLE), view.w >= WHOLE.w - 1],
            ] as const
          ).map(([label, go, active]) => (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={go}
              className={cn(
                "min-h-10 px-3.5 text-sm font-semibold",
                active ? "bg-ink text-white" : "text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ms-auto inline-flex gap-1.5">
          <button
            type="button"
            aria-label={m.seating.zoomOut}
            disabled={view.w >= WHOLE.w - 1}
            onClick={() => zoomBy(1 / 1.6)}
            className="flex size-10 items-center justify-center rounded-[10px] border-[1.5px] border-ink text-ink disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={m.seating.zoomIn}
            disabled={view.w <= MIN_W + 1}
            onClick={() => zoomBy(1.6)}
            className="flex size-10 items-center justify-center rounded-[10px] border-[1.5px] border-ink text-ink disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-paper">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="group"
          aria-label={description}
          className="block h-auto w-full select-none"
          style={{ touchAction: zoomedIn ? "none" : "auto" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
        >
          <rect width={PLAN_W} height={PLAN_H} className="fill-paper" />
          <image
            href={audience}
            width={PLAN_W}
            height={PLAN_H}
            preserveAspectRatio="none"
            className="mix-blend-multiply"
            opacity={0.5 * audienceOpacity}
          />
          <path
            d={FLOOR_PATH}
            className="fill-surface stroke-rule"
            strokeWidth={2}
          />

          {(["left", "right"] as const).map((side) => (
            <g key={side}>
              <rect
                x={colX(side === "left" ? 1 : 10)}
                y={388}
                width={9 * 16 - 2}
                height={14}
                rx={3}
                className="fill-ink"
              />
              <text
                x={colX(side === "left" ? 1 : 10) + (9 * 16 - 2) / 2}
                y={395.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                className="fill-white font-semibold"
              >
                {side === "left" ? m.seating.stageLeft : m.seating.stageRight}
              </text>
            </g>
          ))}

          {mine && (
            <rect
              x={X0 - 18}
              y={rowY(mine.row) - 1.5}
              width={BLOCK_W + 36}
              height={CELL + 3}
              rx={4}
              className="fill-gold"
              opacity={0.22}
            />
          )}

          <circle
            cx={POOL.cx}
            cy={POOL.cy}
            r={POOL.r}
            strokeWidth={1.5}
            className="fill-water stroke-water-ink"
          />
          <text
            x={POOL.cx}
            y={POOL.cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            className="fill-water-ink font-semibold"
            letterSpacing="0.08em"
          >
            {m.seating.pool}
          </text>

          {HALL_ROWS.map((row) => (
            <g key={row}>
              {[X0 - 9, X0 + BLOCK_W + 7].map((x) => (
                <text
                  key={x}
                  x={x}
                  y={rowY(row) + CELL / 2 + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={mine?.row === row ? 11 : 9}
                  className={cn(
                    "font-semibold",
                    mine?.row === row ? "fill-ink" : "fill-muted",
                  )}
                >
                  {row}
                </text>
              ))}
            </g>
          ))}

          {seats}

          {mineBox && (
            <>
              <rect
                x={mineBox.x}
                y={mineBox.y}
                width={CELL}
                height={CELL}
                rx={3}
                fill="none"
                strokeWidth={2.5}
                className="hall-pulse stroke-gold"
              />
              <rect
                x={mineBox.x + CELL / 2 - 14}
                y={mineBox.y - 15}
                width={28}
                height={12}
                rx={6}
                className="fill-ink"
              />
              <text
                x={mineBox.x + CELL / 2}
                y={mineBox.y - 9}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7}
                className="fill-white font-bold"
              >
                {m.seating.you}
              </text>
            </>
          )}

          <rect
            x={STAGE.x}
            y={STAGE.y}
            width={STAGE.w}
            height={STAGE.h}
            rx={6}
            className="fill-ink"
          />
          <text
            x={STAGE.x + STAGE.w / 2}
            y={STAGE.y + STAGE.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            className="fill-white font-semibold"
          >
            {m.seating.stage}
          </text>
        </svg>
      </div>
      {onSeatClick && !zoomedIn && (
        <p className="text-sm text-muted">{m.seating.tapToZoom}</p>
      )}
    </div>
  );
}
