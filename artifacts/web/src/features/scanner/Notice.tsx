import { useEffect, useRef } from "react";
import { NOTICE_MS } from "@/config";

interface NoticeProps {
  message: string | null;
  onDone: () => void;
}

/** A short message at the bottom of the screen that clears itself. */
export function Notice({ message, onDone }: NoticeProps) {
  // The timer must not restart every time the screen re-renders with a new callback.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onDoneRef.current(), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [message]);

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
