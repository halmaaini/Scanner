import { warnIfDatabaseTestsSkipped } from "./src/test-database";
import { defineConfig } from "vitest/config";

warnIfDatabaseTestsSkipped();

export default defineConfig({
  test: {
    // The tests share one real database, so files must not run side by side.
    fileParallelism: false,
  },
});
