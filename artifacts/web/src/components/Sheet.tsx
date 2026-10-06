import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { m } from "@/messages";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that slides up from the bottom on a phone: easy to reach with a
 * thumb, closed by its button, a tap outside, or Escape.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label={m.seating.sheet.close}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="min-w-0 font-display text-2xl leading-tight font-semibold"
          >
            {title}
          </h2>
          <button
            type="button"
            autoFocus
            aria-label={m.seating.sheet.close}
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
