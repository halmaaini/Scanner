import {
  HALL_EXTRA_ROWS,
  HALL_ROWS,
  seatLabel,
  seatsInRow,
} from "@workspace/attendance";
import { FastForward, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import audienceUrl from "@/assets/hall-audience.webp";
import { PROCESSION } from "@/config";
import { cn } from "@/lib/cn";
import { themeColor } from "@/lib/theme";
import { m } from "@/messages";
import { drawFigure, tossOf, type FigureColours } from "./figure";
import {
  AREA,
  BLOCK_W,
  CELL,
  FLOOR_PATH,
  HEADER_Y,
  MIN_W,
  PITCH,
  PLAN_H,
  PLAN_W,
  POOL,
  STAGE,
  WHOLE,
  X0,
  colX,
  rowY,
} from "./geometry";
import {
  buildProcession,
  pointAt,
  seatCenter,
  type SeatPosition,
} from "./procession";

interface ProcessionPlayerProps {
  /** Every seat someone holds: one graduate walks to each. */
  taken: readonly SeatPosition[];
  mine: SeatPosition;
}

type Phase = "playing" | "done";
type ViewMode = "seat" | "whole";

interface Camera {
  cx: number;
  cy: number;
  w: number;
  /** Ease slowly (the calm close-ups), not quickly (following a walker). */
  slow?: boolean;
}

const ASPECT = WHOLE.w / PLAN_H;
const SEAT_W = 225;
const FOLLOW_W = 240;

function clamp(c: Camera): Camera {
  const w = Math.min(Math.max(c.w, MIN_W), WHOLE.w);
  const h = w / ASPECT;
  return {
    w,
    cx: Math.min(Math.max(c.cx, WHOLE.x + w / 2), WHOLE.x + WHOLE.w - w / 2),
    cy: Math.min(Math.max(c.cy, h / 2), PLAN_H - h / 2),
    slow: c.slow,
  };
}

const formatSecs = (s: number) => {
  const whole = Math.max(0, Math.round(s));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * The procession, played on the hall plan: two lines of graduates come out
 * from behind the stage and fill the hall, front row first; the view follows
 * the student (in gold) to their seat, settles on it, and the caps go up.
 * Drawn on a canvas, since a few hundred figures move at once.
 */
export function ProcessionPlayer({ taken, mine }: ProcessionPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const procession = useMemo(() => buildProcession(taken, mine), [taken, mine]);
  const reduced = useMemo(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [phase, setPhase] = useState<Phase>(reduced ? "done" : "playing");
  const [viewMode, setViewMode] = useState<ViewMode>("seat");
  const [shownSecs, setShownSecs] = useState(0);

  // Everything the animation loop reads lives in a ref, so a frame never waits on React.
  const live = useRef({
    t: reduced ? procession.end : 0,
    phase: phase as Phase,
    viewMode: viewMode as ViewMode,
    cam: { cx: WHOLE.x + WHOLE.w / 2, cy: PLAN_H / 2, w: WHOLE.w } as Camera,
    wake: () => {},
  });
  live.current.phase = phase;
  live.current.viewMode = viewMode;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const audience = new Image();
    audience.src = audienceUrl;

    const colour = {
      paper: themeColor("paper"),
      surface: themeColor("surface"),
      ink: themeColor("ink"),
      muted: themeColor("muted"),
      rule: themeColor("rule"),
      gold: themeColor("gold"),
      seat: themeColor("seat"),
      seatInk: themeColor("seat-ink"),
      extra: themeColor("extra"),
      water: themeColor("water"),
      waterInk: themeColor("water-ink"),
      gown: themeColor("gown"),
    };
    const figure: FigureColours = {
      gown: colour.gown,
      cap: themeColor("cap"),
      face: themeColor("face"),
      outline: colour.surface,
      gold: colour.gold,
    };
    const font = getComputedStyle(document.body).fontFamily;
    const floor = new Path2D(FLOOR_PATH);
    const bySeat = new Map(
      procession.walkers.map((w) => [seatLabel(w.seat.row, w.seat.number), w]),
    );
    const mineSeat = procession.mine?.seat;
    const mineKey = mineSeat ? seatLabel(mineSeat.row, mineSeat.number) : "";
    const seatCam = (): Camera => {
      const c = mineSeat ? seatCenter(mineSeat) : { x: AREA.x, y: AREA.y };
      return { cx: c.x, cy: c.y, w: SEAT_W, slow: true };
    };
    const areaCam: Camera = {
      cx: AREA.x + AREA.w / 2,
      cy: AREA.y + AREA.h / 2,
      w: AREA.w,
    };
    const wholeCam: Camera = {
      cx: WHOLE.x + WHOLE.w / 2,
      cy: PLAN_H / 2,
      w: WHOLE.w,
    };

    function target(): Camera {
      const { t, phase, viewMode } = live.current;
      if (phase === "done") {
        return viewMode === "whole" ? { ...wholeCam, slow: true } : seatCam();
      }
      const me = procession.mine;
      if (t >= procession.seatedAt) return seatCam();
      if (me && t >= me.start - 0.6 && t < me.arrive + 1.2) {
        const p =
          t < me.arrive
            ? pointAt(me.route, Math.max(0, (t - me.start) * PROCESSION.speed))
            : seatCenter(me.seat);
        return { cx: p.x, cy: p.y, w: FOLLOW_W };
      }
      // Open on the whole room, then settle on the student floor while the lines come in.
      return t < 1.2 ? wholeCam : areaCam;
    }

    function text(
      s: string,
      x: number,
      y: number,
      size: number,
      fill: string,
      weight = 600,
    ) {
      ctx.fillStyle = fill;
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s, x, y);
    }
    function box(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    }
    function tag(x: number, y: number) {
      ctx.fillStyle = colour.ink;
      box(x - 14, y - 6, 28, 12, 6);
      ctx.fill();
      text(m.seating.you, x, y + 0.5, 7, colour.surface, 700);
    }

    function draw() {
      const cssW = canvas.clientWidth;
      if (!cssW) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssH = cssW / ASPECT;
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      const { t, phase, cam } = live.current;
      const done = phase === "done";
      const s = cssW / cam.w;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colour.paper;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.setTransform(
        dpr * s,
        0,
        0,
        dpr * s,
        dpr * (cssW / 2 - cam.cx * s),
        dpr * (cssH / 2 - cam.cy * s),
      );

      // The audience, greyed out; it fades as the view closes in on the students.
      const seen = Math.min(1, Math.max(0, (cam.w - 300) / (WHOLE.w - 300)));
      if (seen > 0 && audience.complete && audience.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = 0.5 * seen;
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(audience, 0, 0, PLAN_W, PLAN_H);
        ctx.restore();
      }
      ctx.fillStyle = colour.surface;
      ctx.fill(floor);
      ctx.strokeStyle = colour.rule;
      ctx.lineWidth = 2;
      ctx.stroke(floor);

      for (const [side, column] of [
        ["left", 1],
        ["right", 10],
      ] as const) {
        const w = 9 * PITCH - 2;
        ctx.fillStyle = colour.ink;
        box(colX(column), HEADER_Y, w, 14, 3);
        ctx.fill();
        text(
          side === "left" ? m.seating.stageLeft : m.seating.stageRight,
          colX(column) + w / 2,
          HEADER_Y + 7.5,
          8,
          colour.surface,
          700,
        );
      }
      if (mineSeat) {
        ctx.fillStyle = colour.gold;
        ctx.globalAlpha = 0.22;
        box(X0 - 18, rowY(mineSeat.row) - 1.5, BLOCK_W + 36, CELL + 3, 4);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = colour.water;
      ctx.strokeStyle = colour.waterInk;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(POOL.cx, POOL.cy, POOL.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      text(m.seating.pool, POOL.cx, POOL.cy, 11, colour.waterInk, 700);

      const numbers = s * CELL > 13;
      const tossing =
        !done && t >= procession.tossAt
          ? (t - procession.tossAt) / PROCESSION.tossSecs
          : -1;
      for (const row of HALL_ROWS) {
        const mineRow = mineSeat?.row === row;
        for (const x of [X0 - 9, X0 + BLOCK_W + 7]) {
          text(
            row,
            x,
            rowY(row) + CELL / 2 + 0.5,
            mineRow ? 11 : 9,
            mineRow ? colour.ink : colour.muted,
            700,
          );
        }
        for (const seat of seatsInRow(row)) {
          const key = seatLabel(row, seat.number);
          const walker = bySeat.get(key);
          const x = colX(seat.column);
          const y = rowY(row);
          const c = seatCenter(seat);
          const seated = !!walker && (done || t >= walker.arrive);
          const since = walker ? t - walker.arrive : 0;
          const hop =
            seated && !done && since < 0.35
              ? -2.5 * Math.sin((Math.PI * since) / 0.35)
              : 0;
          const toss = tossing >= 0 ? tossOf(key, tossing) : null;
          const isMine = key === mineKey;
          if (isMine) {
            ctx.save();
            ctx.shadowColor = colour.gold;
            ctx.shadowBlur = 14;
            ctx.fillStyle = colour.gold;
            box(x, y, CELL, CELL, 3);
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = colour.ink;
            ctx.lineWidth = 1.6;
            box(x, y, CELL, CELL, 3);
            ctx.stroke();
          } else {
            ctx.fillStyle = HALL_EXTRA_ROWS.includes(row)
              ? colour.extra
              : colour.seat;
            box(x, y, CELL, CELL, 3);
            ctx.fill();
          }
          if (seated) {
            drawFigure(
              ctx,
              c.x,
              c.y + 0.5 + hop,
              0.44,
              isMine ? colour.gold : colour.gown,
              figure,
              { glow: isMine, toss },
            );
          } else if (numbers || isMine) {
            text(
              String(seat.number),
              c.x,
              c.y + 0.5,
              isMine ? 8.5 : 7.5,
              isMine ? colour.ink : colour.seatInk,
              isMine ? 700 : 600,
            );
          }
        }
      }

      // The ones still walking; lower on the plan is nearer, so drawn last.
      if (!done) {
        const moving = procession.walkers
          .filter((w) => t >= w.start && t < w.arrive)
          .map((w, i) => {
            const p = pointAt(w.route, (t - w.start) * PROCESSION.speed);
            return { w, x: p.x, y: p.y - Math.abs(Math.sin(t * 9 + i)) * 0.8 };
          })
          .sort((a, b) => a.y - b.y);
        let me: (typeof moving)[number] | undefined;
        for (const walker of moving) {
          if (walker.w.mine) me = walker;
          else drawFigure(ctx, walker.x, walker.y, 0.5, colour.gown, figure);
        }
        if (me) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6);
          ctx.strokeStyle = colour.gold;
          ctx.globalAlpha = 0.55 * (1 - pulse);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(me.x, me.y, 7 + 7 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          drawFigure(ctx, me.x, me.y, 0.62, colour.gold, figure, {
            glow: true,
          });
          tag(me.x, me.y - 17);
        }
      }

      // The stage last: the lines come out from behind it.
      ctx.fillStyle = colour.ink;
      box(STAGE.x, STAGE.y, STAGE.w, STAGE.h, 6);
      ctx.fill();
      text(
        m.seating.stage,
        STAGE.x + STAGE.w / 2,
        STAGE.y + STAGE.h / 2 + 0.5,
        13,
        colour.surface,
        700,
      );
      if (
        mineSeat &&
        (done || !procession.mine || t >= procession.mine.arrive)
      ) {
        const c = seatCenter(mineSeat);
        tag(c.x, c.y - 15);
      }
    }

    let frame = 0;
    let last = 0;
    let shown = -1;
    function tick(now: number) {
      const state = live.current;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (state.phase === "playing") {
        state.t = Math.min(state.t + dt, procession.end);
        if (state.t >= procession.end) setPhase("done");
      }
      // Following a walker needs a quick pan; zooming is kept slow and calm.
      const goal = clamp(target());
      const pan = 1 - Math.pow(goal.slow ? 0.25 : 0.02, dt);
      const zoom = 1 - Math.pow(goal.slow ? 0.35 : 0.2, dt);
      const cam = state.cam;
      cam.cx += (goal.cx - cam.cx) * pan;
      cam.cy += (goal.cy - cam.cy) * pan;
      cam.w += (goal.w - cam.w) * zoom;
      state.cam = clamp(cam);
      draw();

      const secs = Math.round(state.t);
      if (secs !== shown) {
        shown = secs;
        setShownSecs(secs);
      }
      const settled =
        Math.abs(goal.w - cam.w) < 0.5 &&
        Math.hypot(goal.cx - cam.cx, goal.cy - cam.cy) < 0.3;
      if (state.phase === "playing" || !settled) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
      }
    }
    const wake = () => {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    live.current.wake = wake;
    audience.onload = wake;
    const resize = new ResizeObserver(() => {
      draw();
      wake();
    });
    resize.observe(canvas);
    wake();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [procession]);

  // A change of phase or view needs the loop running again.
  useEffect(() => live.current.wake(), [phase, viewMode]);

  function replay() {
    live.current.t = reduced ? procession.end : 0;
    setViewMode("seat");
    setPhase(reduced ? "done" : "playing");
    live.current.wake();
  }
  function forward() {
    const state = live.current;
    state.t = Math.min(state.t + PROCESSION.forwardSecs, procession.end);
    if (state.t >= procession.end) setPhase("done");
    state.wake();
  }

  return (
    <div className="flex flex-col gap-2.5">
      {phase === "done" && (
        <div
          role="group"
          aria-label={m.seating.zoom}
          className="inline-flex self-start overflow-hidden rounded-[10px] border-[1.5px] border-ink"
        >
          {(["seat", "whole"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "min-h-10 px-3.5 text-sm font-semibold",
                viewMode === mode ? "bg-ink text-white" : "text-ink",
              )}
            >
              {mode === "seat" ? m.seating.mySeat : m.seating.wholeHall}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-paper">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={m.seating.procession.label}
          className="block w-full"
          style={{ aspectRatio: `${ASPECT}` }}
        />
      </div>
      {reduced && (
        <p className="text-sm text-muted">
          {m.seating.procession.reducedMotion}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={replay}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] px-4 text-base font-semibold whitespace-nowrap",
            phase === "done"
              ? "bg-ink text-white"
              : "border-2 border-ink text-ink",
          )}
        >
          <RotateCcw className="size-5" aria-hidden />
          {m.seating.procession.replay}
        </button>
        {phase === "playing" && (
          <button
            type="button"
            onClick={forward}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-2 border-ink px-4 text-base font-semibold whitespace-nowrap text-ink"
          >
            <FastForward className="size-5" aria-hidden />
            {m.seating.procession.forward(PROCESSION.forwardSecs)}
          </button>
        )}
        <span className="basis-full text-sm text-muted tabular-nums">
          {m.seating.procession.time(
            formatSecs(shownSecs),
            formatSecs(procession.end),
          )}
        </span>
      </div>
    </div>
  );
}
