import { writeFileSync } from "node:fs";
import QRCode from "qrcode";

const WIDTH = 640;
const HEIGHT = 480;
const FRAMES = 10;

/**
 * Writes a short raw-video (Y4M) file of a QR code on white, for Chromium's
 * fake camera. No video tools needed: Y4M is a text header plus raw frames.
 */
export function writeQrVideo(filePath: string, text: string): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const quiet = 4;
  const pixel = Math.floor(
    (Math.min(WIDTH, HEIGHT) * 0.8) / (modules + 2 * quiet),
  );
  const side = (modules + 2 * quiet) * pixel;
  const left = Math.floor((WIDTH - side) / 2);
  const top = Math.floor((HEIGHT - side) / 2);

  // Luma plane: white everywhere, black where the QR has a dark module.
  const luma = Buffer.alloc(WIDTH * HEIGHT, 235);
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!qr.modules.get(row, col)) continue;
      for (let dy = 0; dy < pixel; dy++) {
        const y = top + (row + quiet) * pixel + dy;
        luma.fill(
          16,
          y * WIDTH + left + (col + quiet) * pixel,
          y * WIDTH + left + (col + quiet + 1) * pixel,
        );
      }
    }
  }
  const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), luma, chroma, chroma]);

  writeFileSync(
    filePath,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F10:1 Ip A1:1 C420jpeg\n`),
      ...Array.from({ length: FRAMES }, () => frame),
    ]),
  );
}
