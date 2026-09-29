/** Why the camera is not showing: what the person can do about it differs. */
export type CameraProblem = "denied" | "unavailable" | "insecure" | "error";

/** What the browser's error for opening the camera means. */
export function classifyCameraError(error: unknown): CameraProblem {
  const name = error instanceof DOMException ? error.name : "";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return "denied";
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return "unavailable";
  }
  return "error";
}

/**
 * Works out why the camera would not start. The QR library reports every
 * failure as the same "Camera not found." string, so the real reason (blocked,
 * missing, busy, or the page not being secure) is asked for again straight from
 * the browser.
 */
export async function diagnoseCameraFailure(): Promise<CameraProblem> {
  // Browsers offer the camera to secure (https) pages only.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "insecure";
  }
  if (!navigator.mediaDevices?.getUserMedia) return "unavailable";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // It does open: the library's failure was something else, such as the
    // preferred camera or another app holding it.
    stream.getTracks().forEach((track) => track.stop());
    return "error";
  } catch (error) {
    return classifyCameraError(error);
  }
}
