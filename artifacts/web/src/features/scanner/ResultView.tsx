import { Check, Clock, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { buttonStyles } from "@/components/buttonStyles";
import { cn } from "@/lib/cn";
import { m } from "@/messages";
import {
  describeResult,
  type ResultDescription,
  type Tone,
} from "./describeResult";

const TONES: Record<
  Tone,
  { screen: string; accent: string; note: string; Icon: typeof Check }
> = {
  ok: {
    screen: "bg-ok",
    accent: "text-ok",
    note: "text-white/85",
    Icon: Check,
  },
  warn: {
    screen: "bg-warn",
    accent: "text-warn",
    note: "text-warn-soft",
    Icon: Clock,
  },
  bad: { screen: "bg-bad", accent: "text-bad", note: "text-bad-soft", Icon: X },
};

interface ResultViewProps {
  description: ResultDescription;
  /** Offered only for a check-in the signed-in person is allowed to undo. */
  canUndo: boolean;
  /** Resolves true if the undo was accepted (the screen is then closed by the caller). */
  onUndo: () => Promise<boolean>;
  onNext: () => void;
}

/**
 * The full-screen answer after a scan. Colour first, so it reads at arm's
 * length: green to admit, amber for a repeat, red to stop.
 */
export function ResultView({
  description,
  canUndo,
  onUndo,
  onNext,
}: ResultViewProps) {
  const titleId = useId();
  const tone = TONES[description.tone];
  const [undoing, setUndoing] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);

  // Escape means "next". (Enter works too: the Scan next button is focused on open.)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext]);

  async function undo() {
    setUndoing(true);
    setUndoFailed(false);
    const accepted = await onUndo();
    if (!accepted) {
      setUndoing(false);
      setUndoFailed(true);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn(
        "on-dark fixed inset-0 z-50 overflow-y-auto text-white",
        tone.screen,
      )}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-7 px-6 pt-14 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-5 pt-9">
          <div className="flex size-28 items-center justify-center rounded-full bg-white">
            <tone.Icon
              className={cn("size-14", tone.accent)}
              strokeWidth={2.6}
              aria-hidden
            />
          </div>
          <h1
            id={titleId}
            className="text-center font-display text-4xl leading-[1.15] font-semibold"
          >
            {description.title}
          </h1>
          {description.offlineNote && (
            <p className="rounded-lg bg-black/25 px-3 py-2 text-center text-sm">
              {description.offlineNote}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 rounded-[20px] bg-white p-6 text-ink">
          <p className="font-display text-[28px] leading-tight font-semibold">
            <bdi>{description.name}</bdi>
          </p>
          <p className="text-[17px] text-muted">{description.idLine}</p>
          {description.rows.length > 0 && (
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-rule pt-4">
              {description.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between gap-4 text-base"
                >
                  <dt className="text-muted">{row.label}</dt>
                  <dd
                    className={cn(
                      "text-end font-semibold",
                      row.emphasis && tone.accent,
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {description.note && (
          <p
            className={cn("text-center text-[15px] leading-normal", tone.note)}
          >
            {description.note}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-1">
          <button
            type="button"
            autoFocus
            onClick={onNext}
            className={cn(buttonStyles.onTone, tone.accent)}
          >
            {m.results.scanNext}
          </button>
          {canUndo && (
            <>
              <button
                type="button"
                onClick={() => void undo()}
                disabled={undoing}
                className={buttonStyles.linkOnDark}
              >
                {undoing && (
                  <LoaderCircle
                    className="me-2 size-4 animate-spin"
                    aria-hidden
                  />
                )}
                {undoing ? m.results.undoing : m.results.undo}
              </button>
              {undoFailed && (
                <p role="alert" className="text-center text-sm font-semibold">
                  {m.results.undoFailed}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
