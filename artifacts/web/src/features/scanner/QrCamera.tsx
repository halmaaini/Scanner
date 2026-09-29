import { CameraOff } from "lucide-react";
import QrScanner from "qr-scanner";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { m } from "@/messages";

type CameraState = "starting" | "ready" | "denied" | "unavailable" | "error";

/** Browsers report a missing or blocked camera in a few different ways. */
function classify(error: unknown): CameraState {
  const name = error instanceof DOMException ? error.name : "";
  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    /permission|denied/i.test(text)
  ) {
    return "denied";
  }
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    /not found|no camera/i.test(text)
  ) {
    return "unavailable";
  }
  return "error";
}

const problemText: Record<Exclude<CameraState, "ready">, string> = {
  starting: m.scanner.cameraStarting,
  denied: m.scanner.cameraDenied,
  unavailable: m.scanner.cameraUnavailable,
  error: m.scanner.cameraError,
};

interface QrCameraProps {
  /** Keep the camera on but stop reading codes (while a result is on screen). */
  paused: boolean;
  onDecode: (text: string) => void;
}

/** Corner brackets and a sweeping line, as in the prototype. */
function Viewfinder() {
  const corner = "absolute size-9 border-gold";
  return (
    <div className="pointer-events-none absolute inset-[50px]" aria-hidden>
      <div
        className={cn(
          corner,
          "top-0 left-0 rounded-tl-[10px] border-t-4 border-l-4",
        )}
      />
      <div
        className={cn(
          corner,
          "top-0 right-0 rounded-tr-[10px] border-t-4 border-r-4",
        )}
      />
      <div
        className={cn(
          corner,
          "bottom-0 left-0 rounded-bl-[10px] border-b-4 border-l-4",
        )}
      />
      <div
        className={cn(
          corner,
          "right-0 bottom-0 rounded-br-[10px] border-r-4 border-b-4",
        )}
      />
      <div className="scan-line absolute inset-x-3 h-0.5 bg-gold" />
    </div>
  );
}

/**
 * The live camera and QR reader. The camera stays on while a result is shown
 * (only reading is paused) so "Scan next" is instant instead of waiting for
 * the camera to start again.
 */
export function QrCamera({ paused, onDecode }: QrCameraProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const pausedRef = useRef(false);
  const onDecodeRef = useRef(onDecode);
  const [state, setState] = useState<CameraState>("starting");

  // Always call the latest handler without restarting the camera.
  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    // Each scanner gets its own <video>. React may start and stop this effect
    // twice in a row (development), and two scanners sharing one element would
    // wipe each other's camera stream. The element is never hidden with
    // display/visibility either: QrScanner reacts to that by shrinking the
    // video to nothing. The message panel covers it instead.
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.className = "absolute inset-0 h-full w-full object-cover";
    frame.prepend(video);

    let cancelled = false;
    const scanner = new QrScanner(
      video,
      (result) => onDecodeRef.current(result.data),
      {
        preferredCamera: "environment",
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
        highlightScanRegion: false,
        highlightCodeOutline: false,
      },
    );
    scannerRef.current = scanner;
    scanner
      .start()
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch((error: unknown) => {
        if (!cancelled) setState(classify(error));
      });

    return () => {
      cancelled = true;
      scannerRef.current = null;
      pausedRef.current = false;
      scanner.destroy();
      video.remove();
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || state !== "ready") return;
    if (paused && !pausedRef.current) {
      pausedRef.current = true;
      void scanner.pause();
    } else if (!paused && pausedRef.current) {
      pausedRef.current = false;
      scanner.start().catch(() => setState("error"));
    }
  }, [paused, state]);

  return (
    <div
      ref={frameRef}
      className="on-dark relative h-[300px] overflow-hidden rounded-[20px] bg-ink"
    >
      {state === "ready" ? (
        <>
          <Viewfinder />
          <p className="absolute inset-x-0 bottom-3.5 text-center text-sm text-on-dark">
            {m.scanner.cameraHint}
          </p>
        </>
      ) : (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-8 text-center text-[15px] text-on-dark"
        >
          {state !== "starting" && <CameraOff className="size-8" aria-hidden />}
          {problemText[state]}
        </div>
      )}
    </div>
  );
}
