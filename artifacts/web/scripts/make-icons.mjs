// Regenerates every app icon from one drawing (the gold graduation cap on the
// navy tile). Run it when the artwork changes, then commit the results:
//
//   CHROMIUM_PATH=/path/to/chrome pnpm --filter @workspace/web run icons
//
// It writes public/favicon.svg, public/apple-touch-icon.png and public/icons/*.png.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { theme } from "./theme.mjs";

const publicDir = path.resolve(import.meta.dirname, "../public");
const NAVY = theme.ink;
const GOLD = theme.gold;

// The cap, drawn on a 24-unit grid (the same drawing as the lucide "graduation cap").
const CAP = `<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M7 10.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/>`;

/** A navy tile with the cap centred; `capSize` is how many pixels wide the cap is drawn. */
function tile({ size, radius, capSize }) {
  const scale = capSize / 24;
  const offset = (size - capSize) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${NAVY}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${GOLD}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CAP}</g></svg>`
  );
}

const pngs = [
  // "any" icons keep transparent rounded corners.
  ["icons/icon-192.png", { size: 192, radius: 38, capSize: 112 }],
  ["icons/icon-512.png", { size: 512, radius: 102, capSize: 298 }],
  // Maskable icons are cropped by the phone, so the art stays in the middle 60%.
  ["icons/icon-maskable-512.png", { size: 512, radius: 0, capSize: 250 }],
  // iOS rounds the corners itself and dislikes transparency.
  ["apple-touch-icon.png", { size: 180, radius: 0, capSize: 104 }],
];

await mkdir(path.join(publicDir, "icons"), { recursive: true });
await writeFile(
  path.join(publicDir, "favicon.svg"),
  tile({ size: 64, radius: 14, capSize: 38 }) + "\n",
);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  for (const [file, spec] of pngs) {
    const page = await browser.newPage({
      viewport: { width: spec.size, height: spec.size },
    });
    await page.setContent(
      `<body style="margin:0;background:transparent">${tile(spec)}</body>`,
    );
    await page.screenshot({
      path: path.join(publicDir, file),
      omitBackground: true,
    });
    await page.close();
    console.log("wrote", file);
  }
} finally {
  await browser.close();
}
