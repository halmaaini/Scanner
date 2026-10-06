import { Download, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { can } from "@workspace/attendance";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { attendeeRows, type AttendeeStatus } from "@/domain/attendees";
import { buildAttendanceCsv } from "@/domain/export";
import { summarizeEvents } from "@/domain/summary";
import { useCurrentStaff } from "@/features/auth/StaffContext";
import { SeatsView } from "@/features/seating/SeatsView";
import { useListCheckIn } from "./useListCheckIn";
import { IssuesBanner } from "@/features/scanner/IssuesBanner";
import { Notice } from "@/features/scanner/Notice";
import { SyncStatus } from "@/features/scanner/SyncStatus";
import { cn } from "@/lib/cn";
import { downloadTextFile } from "@/lib/download";
import { formatDay, formatWhen } from "@/lib/format";
import { StudentNote } from "@/features/notes/StudentNote";
import { m } from "@/messages";
import { useRosterView } from "@/offline/hooks";

const STATUSES: AttendeeStatus[] = ["all", "in", "out"];

/** Progress per event, the list of attendees with who has checked in, and the CSV. */
export function ReportPage() {
  const staff = useCurrentStaff();
  const { view, query } = useRosterView();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<AttendeeStatus>("all");
  const [chosenEvent, setChosenEvent] = useState<string>();
  const [tab, setTab] = useState<"list" | "seats">("list");

  const { checkIn, checkingIn, notice, clearNotice } = useListCheckIn(
    view,
    chosenEvent && view?.events.some((e) => e.id === chosenEvent)
      ? chosenEvent
      : view?.events[0]?.id,
  );
  const summaries = useMemo(() => (view ? summarizeEvents(view) : []), [view]);
  const eventId =
    chosenEvent && view?.events.some((e) => e.id === chosenEvent)
      ? chosenEvent
      : view?.events[0]?.id;
  // Check-ins are only for open events; a closed one is for looking.
  const chosen = view?.events.find((e) => e.id === eventId);
  const eventOpen = chosen?.isOpen ?? false;
  // The seat plan is only offered for events that have one.
  const seated = chosen?.hasSeating ?? false;
  const showTab = seated ? tab : "list";
  const rows = useMemo(
    () =>
      view && eventId
        ? attendeeRows(view, { eventId, status, query: text })
        : [],
    [view, eventId, status, text],
  );

  function exportCsv() {
    if (!view) return;
    downloadTextFile(`attendance-${formatDay()}.csv`, buildAttendanceCsv(view));
  }

  return (
    <Screen width="wide" className="pt-7">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-semibold">
          {m.report.title}
        </h1>
        <nav className="flex items-center gap-4">
          {can(staff.role, "manage_events") && (
            <Link href="/events" className={buttonStyles.link}>
              {m.report.events}
            </Link>
          )}
          <Link href="/scan" className={buttonStyles.link}>
            {m.report.scanner}
          </Link>
        </nav>
      </header>

      {!view ? (
        query.isPending ? (
          <p role="status" className="flex items-center gap-2 text-muted">
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
            {m.report.loading}
          </p>
        ) : (
          <section className="flex flex-col items-start gap-3 rounded-[20px] bg-surface p-6">
            <p role="alert">{m.report.failed}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {m.common.retry}
            </Button>
          </section>
        )
      ) : (
        <>
          <section className="flex flex-col gap-3.5">
            {summaries.length === 0 && (
              <p className="text-muted">{m.report.noEvents}</p>
            )}
            {summaries.map(({ event, expected, checkedIn }) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-2xl bg-surface p-4"
              >
                <div className="flex justify-between gap-3 text-base">
                  <span className="font-semibold">{event.name}</span>
                  <span>{m.report.progress(checkedIn, expected)}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={event.name}
                  aria-valuemin={0}
                  aria-valuemax={expected}
                  aria-valuenow={checkedIn}
                  className="h-2.5 rounded-full bg-track"
                >
                  <div
                    className="h-2.5 rounded-full bg-ink"
                    style={{
                      width: `${expected === 0 ? 0 : (checkedIn / expected) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>

          {eventId && (
            <section
              aria-labelledby="attendees"
              className="flex flex-col gap-3"
            >
              <h2 id="attendees" className="text-lg font-semibold">
                {m.report.attendees}
              </h2>

              <div className="flex flex-col gap-2">
                <label htmlFor="report-event" className="text-sm font-semibold">
                  {m.report.event}
                </label>
                <select
                  id="report-event"
                  value={eventId}
                  onChange={(e) => setChosenEvent(e.target.value)}
                  className="h-[52px] w-full rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-[17px] text-ink"
                >
                  {view.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.isOpen
                        ? event.name
                        : `${event.name} (${m.events.closed})`}
                    </option>
                  ))}
                </select>
              </div>

              {seated && (
                <div
                  role="group"
                  aria-label={m.seating.views}
                  className="flex gap-2"
                >
                  {(["list", "seats"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={showTab === value}
                      onClick={() => setTab(value)}
                      className={cn(
                        "min-h-11 flex-1 rounded-xl border-[1.5px] px-3 text-[15px] font-semibold",
                        showTab === value
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-surface text-ink",
                      )}
                    >
                      {value === "list" ? m.seating.listTab : m.seating.tab}
                    </button>
                  ))}
                </div>
              )}

              {showTab === "seats" ? (
                <SeatsView
                  roster={view}
                  eventId={eventId}
                  eventOpen={eventOpen}
                  checkIn={checkIn}
                  checkingIn={checkingIn}
                />
              ) : (
                <>
                  <Field
                    label={m.report.findStudent}
                    type="search"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={m.report.findPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <div
                    role="group"
                    aria-label={m.report.filter}
                    className="flex gap-2"
                  >
                    {STATUSES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={status === value}
                        onClick={() => setStatus(value)}
                        className={cn(
                          "min-h-11 flex-1 rounded-xl border-[1.5px] px-3 text-[15px] font-semibold",
                          status === value
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-surface text-ink",
                        )}
                      >
                        {m.report.filters[value]}
                      </button>
                    ))}
                  </div>

                  <p aria-live="polite" className="text-sm text-muted">
                    {m.report.shown(rows.length)}
                  </p>
                  {rows.length === 0 && (
                    <p className="text-muted">{m.report.noMatches}</p>
                  )}
                  <ul className="flex flex-col">
                    {rows.map(({ student, registration, checkedInByName }) => (
                      <li
                        key={student.studentId}
                        className="flex flex-col gap-2 border-b border-rule py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-col">
                            <span className="font-semibold">
                              <bdi>{student.fullName}</bdi>
                            </span>
                            <span className="text-sm text-muted">
                              {student.studentId}
                              {student.major && (
                                <>
                                  {" · "}
                                  <bdi>{student.major}</bdi>
                                </>
                              )}
                            </span>
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                registration.checkedInAt
                                  ? "text-ok"
                                  : "text-muted",
                              )}
                            >
                              {registration.checkedInAt
                                ? m.report.checkedInAt(
                                    formatWhen(registration.checkedInAt),
                                    checkedInByName,
                                  )
                                : m.report.notYet}
                            </span>
                          </div>
                          {!student.isActive ? (
                            <span className="shrink-0 rounded-full bg-bad-soft px-2.5 py-1 text-[13px] font-semibold text-bad">
                              {m.report.revoked}
                            </span>
                          ) : (
                            !registration.checkedInAt &&
                            (eventOpen ? (
                              <Button
                                variant="outline"
                                size="compact"
                                aria-label={m.report.checkInStudent(
                                  student.fullName,
                                )}
                                busy={checkingIn === student.studentId}
                                disabled={checkingIn !== null}
                                onClick={() =>
                                  void checkIn(
                                    student.studentId,
                                    student.fullName,
                                  )
                                }
                              >
                                {m.report.checkIn}
                              </Button>
                            ) : (
                              <span className="shrink-0 text-sm text-muted">
                                {m.events.closed}
                              </span>
                            ))
                          )}
                        </div>
                        <StudentNote
                          studentId={student.studentId}
                          note={student.note}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <IssuesBanner view={view} />
          <div className="mt-auto">
            <SyncStatus />
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-5" aria-hidden />
            {m.report.exportCsv}
          </Button>
        </>
      )}
      <Notice message={notice} onDone={clearNotice} />
    </Screen>
  );
}
