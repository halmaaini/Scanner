import { warnIfDatabaseTestsSkipped } from "@workspace/db/test-database";
import { defineConfig } from "vitest/config";

warnIfDatabaseTestsSkipped();

export default defineConfig({
  test: {
    setupFiles: ["./src/testing/setup.ts"],
    // The tests share one real database, so files must not run side by side.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      SESSION_SECRET: "test-session-secret",
    },
  },
});
