import { CameraOff, LoaderCircle } from "lucide-react";
import QrScanner from "qr-scanner";
import { useEffect, useRef, useState } from "react";
import { CAMERA_SCANS_PER_SECOND, SAME_CODE_COOLDOWN_MS } from "@/config";
import { cn } from "@/lib/cn";
import { m } from "@/messages";
import { diagnoseCameraFailure, type CameraProblem } from "./camera";

type CameraState = "starting" | "ready" | CameraProblem;

const problemText: Record<Exclude<CameraState, "ready">, string> = {
  starting: m.scanner.cameraStarting,
  denied: m.scanner.cameraDenied,
  unavailable: m.scanner.cameraUnavailable,
  insecure: m.scanner.cameraInsecure,
  error: m.scanner.cameraError,
};

interface QrCameraProps {
  /** Keep the camera on but ignore what it reads (while a result is on screen). */
  paused: boolean;
  /** A scan is being checked: say so over the picture. */
  busy: boolean;
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
 * The live camera and QR reader. The camera stays on the whole time: while a
 * result is shown it only stops reporting codes, so "Scan next" is instant
 * instead of waiting for the camera (and possibly a permission prompt) again.
 */
export function QrCamera({ paused, busy, onDecode }: QrCameraProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const onDecodeRef = useRef(onDecode);
  // The code last reported, and until when the same code is ignored (see below).
  const lastCode = useRef<string | null>(null);
  const ignoreRepeatUntil = useRef(0);
  const [state, setState] = useState<CameraState>("starting");

  // Always call the latest handler without restarting the camera.
  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    pausedRef.current = paused;
    // The code that was just dealt with is probably still in front of the
    // camera when the result is dismissed; do not scan it again straight away.
    if (!paused) ignoreRepeatUntil.current = Date.now() + SAME_CODE_COOLDOWN_MS;
  }, [paused]);

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
      (result) => {
        if (pausedRef.current) return;
        const text = result.data;
        if (
          text === lastCode.current &&
          Date.now() < ignoreRepeatUntil.current
        ) {
          return;
        }
        lastCode.current = text;
        onDecodeRef.current(text);
      },
      {
        preferredCamera: "environment",
        maxScansPerSecond: CAMERA_SCANS_PER_SECOND,
        returnDetailedScanResult: true,
        highlightScanRegion: false,
        highlightCodeOutline: false,
      },
    );
    scanner
      .start()
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch(async () => {
        const problem = await diagnoseCameraFailure();
        if (!cancelled) setState(problem);
      });

    return () => {
      cancelled = true;
      scanner.destroy();
      video.remove();
    };
  }, []);

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
          {busy && (
            <p
              role="status"
              className="absolute inset-0 flex items-center justify-center gap-2.5 bg-ink/80 text-lg font-semibold text-white"
            >
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
              {m.scanner.checking}
            </p>
          )}
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
