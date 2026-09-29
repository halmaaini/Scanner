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
 * Browser launch options: fake camera on (no prompts), optionally showing a
 * video file, and a browser of your choosing via CHROMIUM_PATH.
 */
export function browserArgs(cameraVideo?: string) {
  return {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      ...(cameraVideo
        ? [`--use-file-for-fake-video-capture=${cameraVideo}`]
        : []),
    ],
  };
}
