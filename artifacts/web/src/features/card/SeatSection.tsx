import type { Card } from "@workspace/api-client-react";
import { findSeat } from "@workspace/attendance";
import { seatDirections } from "@/domain/seating";
import { HallPlan } from "@/features/seating/HallPlan";
import { m } from "@/messages";

/**
 * Where the student sits: the seat in words, and the hall plan arriving at
 * it. Shown only when one of their events has a seating plan.
 */
export function SeatSection({ card }: { card: Card }) {
  if (!card.events.some((event) => event.hasSeating)) return null;

  const t = m.seating.card;
  const seat =
    card.seatRow && card.seatNumber
      ? findSeat(card.seatRow, card.seatNumber)
      : undefined;
  const given = !!card.seatRow && !!card.seatNumber;
  const where = seat ? seatDirections(seat) : undefined;

  return (
    <section aria-labelledby="seat-title" className="flex flex-col gap-3">
      <h2 id="seat-title" className="font-display text-[22px] font-semibold">
        {t.title}
      </h2>
      {!given ? (
        <p className="text-muted">{t.notAssigned}</p>
      ) : !seat || !where ? (
        <>
          <p className="text-lg font-semibold">
            {m.seating.seatLabel(card.seatRow!, card.seatNumber!)}
          </p>
          <p className="text-muted">{t.offPlan}</p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-gold px-4 py-3 text-ink">
            <Part label={t.row} value={seat.row} />
            <Part label={t.seat} value={String(seat.number)} />
            <Part label={t.side} value={m.seating.side[where.side]} small />
          </div>
          <p>
            {t.rowsBack(where.rowsBack)}{" "}
            {t.where(m.seating.side[where.side], seat.number, where.seatsInRow)}
          </p>
          <div className="rounded-[20px] bg-surface p-3">
            <HallPlan
              start="seat"
              mine={{ row: seat.row, number: seat.number }}
              closeUpLabel={m.seating.mySeat}
              description={t.planLabel}
            />
          </div>
        </>
      )}
    </section>
  );
}

function Part({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col last:text-end">
      <span className="text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span
        className={`font-display leading-tight font-semibold ${small ? "text-xl" : "text-[26px]"}`}
      >
        {value}
      </span>
    </div>
  );
}
