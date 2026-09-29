import path from "node:path";

export const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
export const TMP_DIR = path.resolve(import.meta.dirname, "../.tmp");
export const SEED_FILE = path.join(REPO_ROOT, "lib/db/sql/seed-demo.sql");

export const API_PORT = 8181;
export const WEB_PORT = 4173;

/** Student IDs that get a fake-camera video showing their QR code. */
export const QR_VIDEO_IDS = ["1007"] as const;

export const qrVideoPath = (studentId: string) =>
  path.join(TMP_DIR, `qr-${studentId}.y4m`);

/**
 * Browser launch options: a browser of your choosing via CHROMIUM_PATH, and a
 * fake camera. By default it is on (no permission prompt) and optionally shows a
 * video file; `camera` can instead make it unusable in the two ways real ones
 * are: blocked by the person, or not there at all.
 */
export function browserArgs(
  cameraVideo?: string,
  camera: "working" | "blocked" | "missing" = "working",
) {
  const flags: Record<typeof camera, string[]> = {
    working: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      ...(cameraVideo
        ? [`--use-file-for-fake-video-capture=${cameraVideo}`]
        : []),
    ],
    // There is a camera, but the person says no.
    blocked: [
      "--use-fake-device-for-media-stream",
      "--deny-permission-prompts",
    ],
    // No fake device: the browser finds no camera at all.
    missing: [],
  };
  return {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: flags[camera],
  };
}
