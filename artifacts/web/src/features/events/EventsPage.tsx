import {
  getGetRosterQueryKey,
  setEventOpen,
  type Event,
  type Roster,
} from "@workspace/api-client-react";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Screen } from "@/components/Screen";
import { Notice } from "@/features/scanner/Notice";
import { cn } from "@/lib/cn";
import { isNetworkError, statusOf } from "@/lib/errors";
import { queryClient } from "@/lib/queryClient";
import { m } from "@/messages";
import { useRosterView } from "@/offline/hooks";

/** The super admin's switchboard: which events scanners offer. Needs a connection. */
export function EventsPage() {
  const { view, query } = useRosterView();
  const [changing, setChanging] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function switchEvent(event: Event) {
    if (changing) return;
    setChanging(event.id);
    try {
      const updated = await setEventOpen(event.id, { isOpen: !event.isOpen });
      // A roster read that began earlier would land after this and put the old state back.
      await queryClient.cancelQueries({ queryKey: getGetRosterQueryKey() });
      queryClient.setQueryData<Roster>(
        getGetRosterQueryKey(),
        (roster) =>
          roster && {
            ...roster,
            events: roster.events.map((e) =>
              e.id === updated.id ? updated : e,
            ),
          },
      );
      void queryClient.invalidateQueries({ queryKey: getGetRosterQueryKey() });
    } catch (error) {
      setNotice(
        statusOf(error) === 403
          ? m.events.forbidden
          : isNetworkError(error)
            ? m.events.needsConnection
            : m.events.failed,
      );
    } finally {
      setChanging(null);
    }
  }

  return (
    <Screen className="pt-7">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-semibold">
          {m.events.title}
        </h1>
        <nav className="flex items-center gap-4">
          <Link href="/report" className={buttonStyles.link}>
            {m.events.report}
          </Link>
          <Link href="/scan" className={buttonStyles.link}>
            {m.events.scanner}
          </Link>
        </nav>
      </header>
      <p className="text-[15px] text-muted">{m.events.intro}</p>

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
      ) : view.events.length === 0 ? (
        <p className="text-muted">{m.events.none}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {view.events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{event.name}</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    event.isOpen ? "text-ok" : "text-muted",
                  )}
                >
                  {event.isOpen ? m.events.open : m.events.closed}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={event.isOpen}
                aria-label={m.events.toggle(event.name)}
                disabled={changing !== null}
                onClick={() => void switchEvent(event)}
                className={cn(
                  "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                  event.isOpen ? "bg-ok" : "bg-line",
                )}
              >
                <span
                  className={cn(
                    "inline-block size-6 rounded-full bg-surface transition-transform",
                    event.isOpen ? "translate-x-7" : "translate-x-1",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Notice message={notice} onDone={() => setNotice(null)} />
    </Screen>
  );
}
