import { defineConfig, devices } from "@playwright/test";
import { API_PORT, REPO_ROOT, WEB_PORT, browserArgs } from "./support/env";

// End-to-end tests: a real browser drives the built app against a real API and
// a real (scratch) Postgres. The database is WIPED, so it needs its own URL:
//
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/scanner_test \
//     pnpm --filter @workspace/e2e test:e2e
//
// Set CHROMIUM_PATH to use a browser you already have instead of Playwright's.
const testDatabase = process.env.TEST_DATABASE_URL;
if (!testDatabase) {
  throw new Error(
    "TEST_DATABASE_URL must point at a scratch Postgres database (it is wiped).",
  );
}

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./support/global-setup.ts",
  // One database, so one test at a time.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    permissions: ["camera"],
    launchOptions: browserArgs(),
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // NODE_ENV=test: plain cookies over http, quiet logs, real migrations.
      command:
        "pnpm --filter @workspace/api-server run build && node --enable-source-maps artifacts/api-server/dist/index.mjs",
      cwd: REPO_ROOT,
      port: API_PORT,
      timeout: 120_000,
      env: {
        DATABASE_URL: testDatabase,
        PORT: String(API_PORT),
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        SESSION_SECRET: "e2e-session-secret",
      },
    },
    {
      // The production build (service worker included), served like the real thing.
      command:
        "pnpm --filter @workspace/web run build && pnpm --filter @workspace/web run serve",
      cwd: REPO_ROOT,
      port: WEB_PORT,
      timeout: 180_000,
      env: {
        PORT: String(WEB_PORT),
        API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
      },
    },
  ],
});
