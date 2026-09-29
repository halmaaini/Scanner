import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Replit sets PORT and BASE_PATH per artifact (see .replit-artifact/artifact.toml);
// the defaults keep `pnpm build` and local runs working without them.
const port = Number(process.env.PORT ?? 5173);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Where `/api` goes when this dev server runs without Replit's path router.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080";
const proxy = { "/api": { target: apiTarget, changeOrigin: false } };

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      // Installable, and the app shell is cached so a scanner still opens with
      // no connection. Data is cached separately by the app (see lib/queryClient).
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Attendance",
        short_name: "Attendance",
        description:
          "Check people in at events, even when the connection drops.",
        theme_color: "#14213d",
        background_color: "#f6f3ec",
        display: "standalone",
        orientation: "portrait",
        scope: basePath,
        // The installed app is the staff scanner; students just use the website.
        start_url: `${basePath}scan`,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: `${basePath}index.html`,
        // API calls are never answered from the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy,
  },
});
