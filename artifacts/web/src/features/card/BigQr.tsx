import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import { themeColor } from "@/lib/theme";
import { m } from "@/messages";

/**
 * The QR code as large as the screen allows on plain white, so a scanner can
 * read it from a distance. Asks the phone to keep the screen on while it is
 * open (where the browser allows; nothing breaks where it does not).
 */
export function BigQr({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let closed = false;
    navigator.wakeLock
      ?.request("screen")
      .then((sentinel) => {
        if (closed) void sentinel.release();
        else lock = sentinel;
      })
      .catch(() => {});
    return () => {
      closed = true;
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.card.bigLabel}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-surface p-6"
    >
      <button
        type="button"
        aria-label={m.card.closeBig}
        onClick={onClose}
        autoFocus
        className="absolute end-4 top-4 flex size-12 items-center justify-center rounded-full border-2 border-ink text-ink"
      >
        <X className="size-6" aria-hidden />
      </button>
      <QRCodeSVG
        value={studentId}
        level="M"
        marginSize={2}
        fgColor={themeColor("ink")}
        bgColor={themeColor("surface")}
        role="img"
        aria-label={m.card.qrLabel(studentId)}
        style={{ width: "min(90vw, 70vh)", height: "auto" }}
      />
      <p className="text-center text-lg font-semibold text-ink">
        {m.card.bigHint}
      </p>
    </div>
  );
}
