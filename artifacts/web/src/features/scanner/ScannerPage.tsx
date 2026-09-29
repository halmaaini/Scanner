import { canUndoCheckIn, can } from "@workspace/attendance";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Screen } from "@/components/Screen";
import { indexRoster } from "@/domain/roster";
import { summarizeEvents, summaryFor } from "@/domain/summary";
import { useCurrentStaff } from "@/features/auth/StaffContext";
import { signOut } from "@/features/auth/signOut";
import { BUZZ_ATTENTION, BUZZ_OK, buzz } from "@/lib/haptics";
import { useOnline } from "@/lib/network";
import { m } from "@/messages";
import { scanning } from "@/offline";
import { useRosterView } from "@/offline/hooks";
import type { ScanResponse } from "@/offline/submit";
import { describeResult } from "./describeResult";
import { IssuesBanner } from "./IssuesBanner";
import { ManualEntry } from "./ManualEntry";
import { Notice } from "./Notice";
import { QrCamera } from "./QrCamera";
import { ResultView } from "./ResultView";
import { SyncStatus } from "./SyncStatus";
import { useSelectedEvent } from "./useSelectedEvent";

type Answer = Exclude<ScanResponse, { kind: "unavailable" }>;

export function ScannerPage() {
  const staff = useCurrentStaff();
  const [, navigate] = useLocation();
  const online = useOnline();
  const { view, query } = useRosterView();

  const openEvents = useMemo(
    () => view?.events.filter((e) => e.isOpen) ?? [],
    [view],
  );
  const {
    eventId,
    choose: chooseEvent,
    replaced,
  } = useSelectedEvent(openEvents);
  const summary = useMemo(
    () => (view ? summaryFor(summarizeEvents(view), eventId) : undefined),
    [view, eventId],
  );
  const index = useMemo(() => (view ? indexRoster(view) : undefined), [view]);

  const [answer, setAnswer] = useState<Answer | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // One scan at a time: the camera reports the same code many times a second.
  const busy = useRef(false);
  // After a typed ID, the cursor goes back to the field once the result is closed.
  const manualField = useRef<HTMLInputElement>(null);
  const returnToField = useRef(false);

  const scan = useCallback(
    async (raw: string, source: "camera" | "typed") => {
      if (busy.current || !eventId) return;
      busy.current = true;
      setChecking(true);
      returnToField.current = source === "typed";
      try {
        const response = await scanning.scan({
          raw,
          eventId,
          staffId: staff.id,
          view,
        });
        if (!response) {
          busy.current = false;
        } else if (response.kind === "unavailable") {
          setNotice(m.scanner.noRosterOffline);
          busy.current = false;
        } else {
          setAnswer(response);
          buzz(
            response.result.outcome === "checked_in" ? BUZZ_OK : BUZZ_ATTENTION,
          );
        }
      } catch {
        setNotice(m.scanner.scanFailed);
        busy.current = false;
      } finally {
        setChecking(false);
      }
    },
    [eventId, staff.id, view],
  );

  const next = useCallback(() => {
    setAnswer(null);
    busy.current = false;
  }, []);

  // The page is out of reach while a result is up; when it closes, a person who
  // was typing gets the cursor back in the field (a camera user does not: that
  // would pop the keyboard over the camera).
  useEffect(() => {
    if (answer === null && returnToField.current) {
      returnToField.current = false;
      manualField.current?.focus();
    }
  }, [answer]);

  const description = useMemo(() => {
    if (!answer) return undefined;
    return describeResult({
      result: answer.result,
      offline: answer.kind === "offline",
      eventName:
        index?.eventById.get(answer.result.eventId)?.name ??
        answer.result.eventId,
      staffName: (id) => index?.staffById.get(id)?.displayName,
    });
  }, [answer, index]);

  async function undo(): Promise<boolean> {
    if (!answer) return false;
    const { studentId, eventId: undoEventId, student } = answer.result;
    const response = await scanning.undo({
      studentId,
      eventId: undoEventId,
      staffId: staff.id,
      scanOpId: answer.opId,
    });
    if (response.kind === "refused") return false;
    setNotice(
      response.kind === "done"
        ? m.results.undone(student?.fullName ?? studentId)
        : m.results.undoQueued,
    );
    next();
    return true;
  }

  async function onSignOut() {
    const result = await signOut(staff.id);
    if (result === "done") navigate("/login", { replace: true });
    if (result === "failed") setNotice(m.auth.signOutFailed);
  }

  const canUndo =
    answer?.result.outcome === "checked_in" &&
    answer.result.registration !== null &&
    canUndoCheckIn(staff, answer.result.registration);

  return (
    <>
      {/* Inert while a result is up: the page behind it cannot be tabbed into or read out. */}
      <Screen className="gap-[18px] pt-7" inert={answer !== null}>
        <h1 className="sr-only">{m.scanner.title}</h1>

        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] text-muted">
              {m.scanner.signedInAs}
            </span>
            <span className="truncate text-base font-semibold">
              {staff.displayName} ({m.scanner.roles[staff.role]})
            </span>
          </div>
          <nav className="flex shrink-0 items-center gap-4">
            {can(staff.role, "view_report") && (
              <Link href="/report" className={buttonStyles.link}>
                {m.scanner.report}
              </Link>
            )}
            <button
              type="button"
              onClick={() => void onSignOut()}
              className={buttonStyles.link}
            >
              {m.common.signOut}
            </button>
          </nav>
        </header>

        {!view ? (
          <RosterUnavailable
            loading={query.isPending}
            online={online}
            onRetry={() => void query.refetch()}
          />
        ) : openEvents.length === 0 ? (
          <section className="flex flex-col gap-2 rounded-[20px] bg-surface p-6">
            <h2 className="font-display text-2xl font-semibold">
              {m.scanner.noOpenEvents.title}
            </h2>
            <p className="text-[15px] leading-normal text-muted">
              {m.scanner.noOpenEvents.body}
            </p>
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="event" className="text-sm font-semibold">
                {m.scanner.event}
              </label>
              <select
                id="event"
                value={eventId}
                onChange={(e) => chooseEvent(e.target.value)}
                className="h-[52px] w-full rounded-xl border-[1.5px] border-ink bg-surface px-3.5 text-[17px] font-semibold text-ink"
              >
                {openEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              {replaced && (
                <p role="status" className="text-sm font-semibold text-warn">
                  {m.scanner.eventReplaced(
                    index?.eventById.get(replaced)?.name ?? replaced,
                    index?.eventById.get(eventId ?? "")?.name ?? "",
                  )}
                </p>
              )}
            </div>

            {summary && (
              <p aria-live="polite">
                <span className="font-display text-3xl font-semibold">
                  {summary.checkedIn}
                </span>{" "}
                <span className="text-[15px] text-muted">
                  {m.scanner.countRest(summary.expected)}
                </span>
              </p>
            )}

            <QrCamera
              paused={answer !== null || checking}
              busy={checking}
              onDecode={(text) => void scan(text, "camera")}
            />

            <div
              className="flex items-center gap-3 text-sm text-muted"
              aria-hidden
            >
              <div className="h-px flex-1 bg-rule" />
              <span>{m.scanner.orType}</span>
              <div className="h-px flex-1 bg-rule" />
            </div>

            <ManualEntry
              inputRef={manualField}
              onSubmit={(id) => void scan(id, "typed")}
              disabled={answer !== null || checking}
            />
          </>
        )}

        <IssuesBanner view={view} />
        <div className="mt-auto">
          <SyncStatus />
        </div>
      </Screen>

      {answer && description && (
        <ResultView
          description={description}
          canUndo={canUndo}
          onUndo={undo}
          onNext={next}
        />
      )}
      <Notice message={notice} onDone={() => setNotice(null)} />
    </>
  );
}

/** No saved student list yet: still loading, or offline for the first time. */
function RosterUnavailable({
  loading,
  online,
  onRetry,
}: {
  loading: boolean;
  online: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {m.scanner.loadingRoster}
      </p>
    );
  }
  return (
    <section className="flex flex-col items-start gap-3 rounded-[20px] bg-surface p-6">
      <p role="alert" className="text-base">
        {online ? m.scanner.rosterFailed : m.scanner.noRosterOffline}
      </p>
      <Button variant="outline" onClick={onRetry}>
        {m.common.retry}
      </Button>
    </section>
  );
}
