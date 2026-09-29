import path from "path";
import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so unit tests do not load the PWA and
// Replit plugins. The tests cover plain logic and need no DOM.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Times are shown in the device's zone; tests pin it so they read the same everywhere.
    env: { TZ: "UTC" },
  },
});
