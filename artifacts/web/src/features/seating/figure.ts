export interface FigureColours {
  gown: string;
  cap: string;
  face: string;
  outline: string;
  gold: string;
}

/** A cap thrown in the air: how high above the head, and how far it has turned. */
export interface Toss {
  dy: number;
  rot: number;
}

/**
 * A graduate standing, drawn at (x, y): gown, face and a mortarboard with a
 * gold tassel. A thin outline keeps them readable on seats and on the floor.
 * About 30 units tall at scale 1.
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  gown: string,
  colours: FigureColours,
  options: { glow?: boolean; toss?: Toss | null } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (options.glow) {
    ctx.shadowColor = colours.gold;
    ctx.shadowBlur = 14;
  }
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = colours.outline;

  ctx.beginPath();
  ctx.moveTo(-5, -3);
  ctx.quadraticCurveTo(0, -6, 5, -3);
  ctx.lineTo(8.5, 12);
  ctx.quadraticCurveTo(0, 14, -8.5, 12);
  ctx.closePath();
  ctx.fillStyle = gown;
  ctx.stroke();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(0, -8, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = colours.face;
  ctx.stroke();
  ctx.fill();

  // The mortarboard: when tossed it flies up from the head, turning, and lands back.
  if (options.toss) {
    ctx.translate(0, -13 + options.toss.dy);
    ctx.rotate(options.toss.rot);
    ctx.translate(0, 13);
  }
  ctx.beginPath();
  ctx.moveTo(-9, -13);
  ctx.lineTo(0, -16.5);
  ctx.lineTo(9, -13);
  ctx.lineTo(0, -9.8);
  ctx.closePath();
  ctx.fillStyle = colours.cap;
  ctx.stroke();
  ctx.fill();
  ctx.fillRect(-3.6, -12.2, 7.2, 3.2);
  ctx.strokeStyle = colours.gold;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -13.2);
  ctx.lineTo(6.5, -12);
  ctx.lineTo(7, -6.5);
  ctx.stroke();
  ctx.fillStyle = colours.gold;
  ctx.beginPath();
  ctx.arc(7, -6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Each cap's own height and spin during the toss, from 0 (thrown) to 1 (back on the head). */
export function tossOf(seatKey: string, progress: number): Toss | null {
  let h = 0;
  for (let i = 0; i < seatKey.length; i++) {
    h = (h * 31 + seatKey.charCodeAt(i)) >>> 0;
  }
  const r1 = (h % 1000) / 1000;
  const r2 = ((h >> 10) % 1000) / 1000;
  // Not all at once: each cap leaves a moment after the last.
  const p = (progress - r1 * 0.12) / 0.88;
  if (p <= 0 || p >= 1) return null;
  return {
    dy: -(28 + 34 * r2) * Math.sin(Math.PI * p),
    rot: (r1 - 0.5) * 4 * Math.PI * p,
  };
}
