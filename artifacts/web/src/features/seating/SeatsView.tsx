import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { seatingView, type SeatMark } from "@/domain/seating";
import type { Roster } from "@/domain/roster";
import { StudentNote } from "@/features/notes/StudentNote";
import { formatWhen } from "@/lib/format";
import { m } from "@/messages";
import { HallPlan, type SeatRef } from "./HallPlan";

const LEGEND: { mark: SeatMark | "empty"; swatch: string }[] = [
  { mark: "present", swatch: "bg-ok" },
  { mark: "expected", swatch: "border-2 border-warn bg-warn-soft" },
  { mark: "revoked", swatch: "border-2 border-bad bg-bad-soft" },
  { mark: "empty", swatch: "bg-seat opacity-60" },
];

interface SeatsViewProps {
  roster: Roster;
  eventId: string;
  /** Whether check-ins are allowed for this event. */
  eventOpen: boolean;
  checkIn: (studentId: string, name: string) => Promise<void>;
  checkingIn: string | null;
}

/**
 * The hall as it stands for one event: who is in, who is still to come, and
 * touch a seat to see the student there. A view of the roster, so it works
 * offline and stays in step with the list.
 */
export function SeatsView({
  roster,
  eventId,
  eventOpen,
  checkIn,
  checkingIn,
}: SeatsViewProps) {
  const eventName = roster.events.find((e) => e.id === eventId)?.name ?? "";
  const seating = useMemo(
    () => seatingView(roster, eventId),
    [roster, eventId],
  );
  const marks = useMemo(
    () => new Map([...seating.bySeat].map(([key, s]) => [key, s.mark])),
    [seating],
  );
  const [selected, setSelected] = useState<SeatRef | null>(null);
  const picked = selected
    ? seating.bySeat.get(m.seating.seat(selected.row, selected.number))
    : undefined;
  const staffName = (id: number | null) =>
    id === null
      ? null
      : (roster.staff.find((s) => s.id === id)?.displayName ?? null);

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="font-semibold">
        {m.seating.counts(seating.present, seating.expected)}
      </p>

      <HallPlan
        start="area"
        closeUpLabel={m.seating.studentArea}
        description={m.seating.planFor(eventName)}
        marks={marks}
        selected={selected}
        onSeatClick={setSelected}
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
        {LEGEND.map(({ mark, swatch }) => (
          <li key={mark} className="inline-flex items-center gap-1.5">
            <span className={`size-3.5 rounded ${swatch}`} aria-hidden />
            {m.seating.legend[mark]}
          </li>
        ))}
      </ul>

      {seating.noSeat.length > 0 && (
        <Problems
          summary={m.seating.noSeat(seating.noSeat.length)}
          names={seating.noSeat.map((s) => s.fullName)}
        />
      )}
      {seating.offPlan.length > 0 && (
        <Problems
          summary={m.seating.offPlan(seating.offPlan.length)}
          names={seating.offPlan.map(
            (s) => `${s.fullName} (${s.seatRow}${s.seatNumber})`,
          )}
        />
      )}

      {selected && (
        <Sheet
          title={
            picked
              ? picked.student.fullName
              : m.seating.seatLabel(selected.row, selected.number)
          }
          onClose={() => setSelected(null)}
        >
          {picked ? (
            <>
              <dl className="flex flex-col gap-1.5 text-base">
                <Row
                  label={m.results.seat}
                  value={`${m.seating.seatLabel(picked.seat.row, picked.seat.number)}, ${m.seating.side[picked.seat.side]}`}
                />
                <Row
                  label={m.results.studentLabel}
                  value={picked.student.studentId}
                />
                {picked.student.major && (
                  <Row label={m.results.major} value={picked.student.major} />
                )}
                <Row
                  label={m.seating.sheet.status}
                  value={
                    picked.mark === "revoked"
                      ? m.report.revoked
                      : picked.registration.checkedInAt
                        ? m.report.checkedInAt(
                            formatWhen(picked.registration.checkedInAt),
                            staffName(picked.registration.checkedInBy),
                          )
                        : m.seating.sheet.notYet
                  }
                />
              </dl>
              {picked.mark === "expected" &&
                (eventOpen ? (
                  <Button
                    busy={checkingIn === picked.student.studentId}
                    disabled={checkingIn !== null}
                    onClick={() =>
                      void checkIn(
                        picked.student.studentId,
                        picked.student.fullName,
                      )
                    }
                  >
                    {m.report.checkIn}
                  </Button>
                ) : (
                  <p className="text-sm text-muted">{m.events.closed}</p>
                ))}
              <StudentNote
                studentId={picked.student.studentId}
                note={picked.student.note}
              />
            </>
          ) : (
            <p className="text-muted">{m.seating.sheet.empty}</p>
          )}
        </Sheet>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-semibold">
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

/** A heads-up about gaps in the data, with the names to fix, folded away until wanted. */
function Problems({ summary, names }: { summary: string; names: string[] }) {
  return (
    <details className="rounded-xl bg-warn-soft px-4 py-3 text-[15px]">
      <summary className="min-h-6 cursor-pointer font-semibold">
        {summary}
      </summary>
      <ul className="mt-2 flex flex-col gap-0.5">
        {names.map((name) => (
          <li key={name}>
            <bdi>{name}</bdi>
          </li>
        ))}
      </ul>
    </details>
  );
}
