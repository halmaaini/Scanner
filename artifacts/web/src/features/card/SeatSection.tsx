import type { Card } from "@workspace/api-client-react";
import { findSeat, neighbourSeats } from "@workspace/attendance";
import { Play } from "lucide-react";
import { useState } from "react";
import { seatDirections } from "@/domain/seating";
import { HallPlan } from "@/features/seating/HallPlan";
import { ProcessionPlayer } from "@/features/seating/ProcessionPlayer";
import { placeInLine } from "@/features/seating/procession";
import { m } from "@/messages";

/**
 * Where the student sits: the seat in words, and the hall plan arriving at
 * it. Shown only when one of their events has a seating plan.
 */
export function SeatSection({ card }: { card: Card }) {
  const [watching, setWatching] = useState(false);
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
          <Facts card={card} />
          <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-3">
            {watching ? (
              <ProcessionPlayer
                // Older saved copies of the card have no list; the student still walks alone.
                taken={card.occupiedSeats ?? []}
                mine={{ seatRow: seat.row, seatNumber: seat.number }}
              />
            ) : (
              <>
                <HallPlan
                  start="seat"
                  mine={{ row: seat.row, number: seat.number }}
                  closeUpLabel={m.seating.mySeat}
                  description={t.planLabel}
                />
                <button
                  type="button"
                  onClick={() => setWatching(true)}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[14px] bg-ink px-5 text-[17px] font-semibold text-white"
                >
                  <Play className="size-5" aria-hidden />
                  {m.seating.procession.watch}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Who sits either side, and where the student walks in the procession. */
function Facts({ card }: { card: Card }) {
  const t = m.seating.card;
  const row = card.seatRow!;
  const number = card.seatNumber!;
  const named = new Map(
    (card.neighbours ?? []).map((n) => [n.seatNumber, n.fullName]),
  );
  const besides = neighbourSeats(row, number);
  const line = placeInLine(card.occupiedSeats ?? [], {
    seatRow: row,
    seatNumber: number,
  });
  return (
    <dl className="flex flex-col gap-3">
      {besides.length > 0 && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t.neighbours}
          </dt>
          {besides.map((seat) => (
            <dd
              key={seat.number}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 font-semibold">
                {named.has(seat.number) ? (
                  <bdi>{named.get(seat.number)}</bdi>
                ) : (
                  <span className="font-normal text-muted">{t.emptySeat}</span>
                )}
              </span>
              <span className="shrink-0 text-sm text-muted tabular-nums">
                {t.seatShort(seat.row, seat.number)}
              </span>
            </dd>
          ))}
        </div>
      )}
      {line && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
            {t.line}
          </dt>
          <dd>{t.place(line.place, line.of, m.seating.side[line.side])}</dd>
        </div>
      )}
    </dl>
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
