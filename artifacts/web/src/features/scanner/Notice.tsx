import { useEffect } from "react";

interface NoticeProps {
  message: string | null;
  onDone: () => void;
}

/** A short message at the bottom of the screen that clears itself. */
export function Notice({ message, onDone }: NoticeProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 4_500);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md"
    >
      {message && (
        <p className="rounded-xl bg-ink px-4 py-3 text-center text-[15px] font-semibold text-white shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}
