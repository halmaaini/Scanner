import { useGetCard, type Card } from "@workspace/api-client-react";
import {
  MAX_STUDENT_ID_LENGTH,
  normalizeStudentId,
} from "@workspace/attendance";
import { Check, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Screen } from "@/components/Screen";
import { Splash } from "@/components/Splash";
import { cn } from "@/lib/cn";
import { isNetworkError, statusOf } from "@/lib/errors";
import { formatEventStart, formatWhen } from "@/lib/format";
import { themeColor } from "@/lib/theme";
import { CARD_STALE_MS } from "@/config";
import { m } from "@/messages";
import { studentIdFromParam } from "./cardPath";
import { initialsOf } from "./initials";
import { BigQr } from "./BigQr";
import { SeatSection } from "./SeatSection";

/** Public: a student's card with their QR code and which events they have attended. */
export function CardPage({ studentId }: { studentId: string }) {
  const id = normalizeStudentId(studentIdFromParam(studentId));
  // Too long to be a student ID: no need to ask the server to say so.
  const tooLong = id.length > MAX_STUDENT_ID_LENGTH;
  const card = useGetCard(encodeURIComponent(id), {
    query: {
      enabled: !tooLong,
      retry: false,
      staleTime: CARD_STALE_MS,
      refetchOnWindowFocus: true,
    },
  });

  if (card.data) {
    return (
      <CardView
        card={card.data}
        // Showing a saved copy because the server could not be reached.
        savedCopy={card.isError && isNetworkError(card.error)}
        refreshing={card.isFetching}
        onRefresh={() => void card.refetch()}
      />
    );
  }
  if (!tooLong && card.isPending) return <Splash />;

  const code = tooLong ? 404 : statusOf(card.error);
  return (
    <Screen className="gap-5 pt-8">
      <Link href="/card" className={buttonStyles.link}>
        {m.common.back}
      </Link>
      {code === 404 ? (
        <section className="flex flex-col gap-2 rounded-[20px] bg-surface p-6">
          <h1 className="font-display text-2xl font-semibold">
            {m.card.notFound.title}
          </h1>
          <p className="text-[15px] text-muted">{m.card.notFound.body}</p>
        </section>
      ) : (
        <section className="flex flex-col items-start gap-3 rounded-[20px] bg-surface p-6">
          <p role="alert" className="text-base">
            {code === 429 ? m.card.tooMany : m.card.failed}
          </p>
          <Button variant="outline" onClick={() => void card.refetch()}>
            {m.common.retry}
          </Button>
        </section>
      )}
    </Screen>
  );
}

interface CardViewProps {
  card: Card;
  savedCopy: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

function CardView({ card, savedCopy, refreshing, onRefresh }: CardViewProps) {
  const [big, setBig] = useState(false);
  return (
    <Screen className="gap-5 pt-8">
      <Link href="/card" className={buttonStyles.link}>
        {m.common.back}
      </Link>

      <article className="on-dark flex flex-col gap-5 rounded-3xl bg-ink p-6 text-white">
        <header className="flex items-center gap-4">
          <div
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gold font-display text-[26px] font-semibold text-ink"
          >
            {initialsOf(card.fullName)}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="font-display text-[26px] leading-[1.15] font-semibold">
              <bdi>{card.fullName}</bdi>
            </h1>
            <p className="text-[15px] text-on-dark">
              {m.results.studentLine(card.studentId)}
            </p>
            {card.major && (
              <p className="text-sm text-on-dark">
                {m.card.major}: <bdi>{card.major}</bdi>
              </p>
            )}
          </div>
        </header>

        {card.isActive ? (
          <>
            <button
              type="button"
              aria-label={m.card.showBig}
              onClick={() => setBig(true)}
              className="self-center rounded-2xl bg-surface p-2"
            >
              <QRCodeSVG
                value={card.studentId}
                size={184}
                level="M"
                marginSize={4}
                fgColor={themeColor("ink")}
                bgColor={themeColor("surface")}
                role="img"
                aria-label={m.card.qrLabel(card.studentId)}
              />
            </button>
            <p className="text-center text-sm text-on-dark">
              {m.card.qrCaption}
            </p>
          </>
        ) : (
          <p
            role="alert"
            className="rounded-xl bg-bad-soft p-4 text-[15px] font-semibold text-bad"
          >
            {m.card.revoked}
          </p>
        )}
      </article>

      {savedCopy && (
        <p className="text-sm font-semibold text-warn">{m.card.offlineCopy}</p>
      )}

      <SeatSection card={card} />

      <section aria-labelledby="attendance-title" className="flex flex-col">
        <h2
          id="attendance-title"
          className="mb-2 font-display text-[22px] font-semibold"
        >
          {m.card.attendance}
        </h2>
        {card.events.length === 0 && (
          <p className="text-muted">{m.card.noEvents}</p>
        )}
        <ul className="flex flex-col">
          {card.events.map((event) => {
            const done = event.checkedInAt !== null;
            return (
              <li
                key={event.id}
                className="flex items-center gap-3.5 border-b border-rule px-1 py-3.5 last:border-b-0"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-ok text-white"
                      : "box-border border-2 border-line",
                  )}
                >
                  {done && <Check className="size-5" strokeWidth={2.6} />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[17px] font-semibold">
                    {event.name}
                  </span>
                  {event.startsAt && (
                    <span className="text-sm">
                      {formatEventStart(event.startsAt)}
                    </span>
                  )}
                  {(event.venue || event.mapUrl) && (
                    <span className="flex flex-wrap items-center gap-x-3 text-sm">
                      {event.venue && <bdi>{event.venue}</bdi>}
                      {event.mapUrl && (
                        <a
                          href={event.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center gap-1 font-semibold underline underline-offset-4"
                        >
                          <MapPin className="size-4" aria-hidden />
                          {m.card.map}
                        </a>
                      )}
                    </span>
                  )}
                  <span className="text-sm text-muted">
                    {event.checkedInAt
                      ? m.card.attendedAt(formatWhen(event.checkedInAt))
                      : m.card.notYet}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    done ? "text-ok" : "text-muted",
                  )}
                >
                  {done ? m.card.done : m.card.pending}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {big && (
        <BigQr studentId={card.studentId} onClose={() => setBig(false)} />
      )}

      <Button variant="outline" busy={refreshing} onClick={onRefresh}>
        {m.card.refresh}
      </Button>
    </Screen>
  );
}
