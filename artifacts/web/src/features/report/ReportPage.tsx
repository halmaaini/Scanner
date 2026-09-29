import { Download, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { buildAttendanceCsv } from "@/domain/export";
import { searchStudents } from "@/domain/search";
import { latestCheckIns, summarizeEvents } from "@/domain/summary";
import { cn } from "@/lib/cn";
import { downloadTextFile } from "@/lib/download";
import { formatWhen } from "@/lib/format";
import { m } from "@/messages";
import { useRosterView } from "@/offline/hooks";

const LATEST_LIMIT = 20;
const SEARCH_LIMIT = 25;

/** The super admin's overview: progress per event, search, latest check-ins, CSV. */
export function ReportPage() {
  const { view, query } = useRosterView();
  const [text, setText] = useState("");

  const summaries = useMemo(() => (view ? summarizeEvents(view) : []), [view]);
  const latest = useMemo(
    () => (view ? latestCheckIns(view, LATEST_LIMIT) : []),
    [view],
  );
  const found = useMemo(
    () =>
      view && text.trim()
        ? searchStudents(view, text, SEARCH_LIMIT)
        : undefined,
    [view, text],
  );

  function exportCsv() {
    if (!view) return;
    const day = new Date().toISOString().slice(0, 10);
    downloadTextFile(`attendance-${day}.csv`, buildAttendanceCsv(view));
  }

  return (
    <Screen width="wide" className="pt-7">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted">{m.report.role}</span>
          <h1 className="font-display text-[28px] font-semibold">
            {m.report.title}
          </h1>
        </div>
        <Link href="/scan" className={buttonStyles.link}>
          {m.report.scanner}
        </Link>
      </header>

      {!view ? (
        query.isPending ? (
          <p role="status" className="flex items-center gap-2 text-muted">
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
            {m.report.loading}
          </p>
        ) : (
          <section className="flex flex-col items-start gap-3 rounded-[20px] bg-white p-6">
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
                className="flex flex-col gap-2 rounded-2xl bg-white p-4"
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

          <Field
            label={m.report.findStudent}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={m.report.findPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />

          {found ? (
            <section aria-live="polite" className="flex flex-col">
              {found.matches.length === 0 && (
                <p className="text-muted">{m.report.noMatches}</p>
              )}
              <ul className="flex flex-col">
                {found.matches.map(({ student, events }) => (
                  <li
                    key={student.studentId}
                    className="flex flex-col gap-2 border-b border-rule py-3"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        <bdi>{student.fullName}</bdi>
                      </span>
                      <span className="text-sm text-muted">
                        {student.studentId}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!student.isActive && (
                        <span className="rounded-full bg-bad-soft px-2.5 py-1 text-[13px] font-semibold text-bad">
                          {m.report.revoked}
                        </span>
                      )}
                      {events.map(({ event, checkedInAt }) => (
                        <span
                          key={event.id}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[13px] font-semibold",
                            checkedInAt
                              ? "bg-ok-soft text-ok"
                              : "bg-track text-muted",
                          )}
                        >
                          {event.name}:{" "}
                          {checkedInAt
                            ? formatWhen(checkedInAt)
                            : m.report.notYet}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {found.total > found.matches.length && (
                <p className="pt-3 text-sm text-muted">
                  {m.report.firstMatches(found.matches.length)}
                </p>
              )}
            </section>
          ) : (
            <section className="flex flex-col">
              <h2 className="mb-1.5 text-[15px] font-semibold text-muted">
                {m.report.latest}
              </h2>
              {latest.length === 0 && (
                <p className="text-muted">{m.report.noCheckIns}</p>
              )}
              <ol className="flex flex-col">
                {latest.map((row) => (
                  <li
                    key={`${row.studentId}-${row.eventName}`}
                    className="flex justify-between gap-4 border-b border-rule py-3 text-[15px] last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">
                        <bdi>{row.fullName}</bdi>
                      </span>
                      <span className="text-muted">
                        {[row.studentId, row.eventName, row.checkedInByName]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted">
                      {formatWhen(row.checkedInAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Button variant="outline" onClick={exportCsv} className="mt-auto">
            <Download className="size-5" aria-hidden />
            {m.report.exportCsv}
          </Button>
        </>
      )}
    </Screen>
  );
}
