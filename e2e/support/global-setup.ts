import { mkdirSync } from "node:fs";
import { QR_VIDEO_IDS, TMP_DIR, qrVideoPath } from "./env";
import { closeDatabase, resetDemoData } from "./db";
import { writeQrVideo } from "./qr-video";

export default async function globalSetup(): Promise<void> {
  mkdirSync(TMP_DIR, { recursive: true });
  for (const id of QR_VIDEO_IDS) writeQrVideo(qrVideoPath(id), id);
  await resetDemoData();
  await closeDatabase();
}
