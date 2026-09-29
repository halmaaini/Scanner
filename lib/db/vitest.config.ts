import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The tests share one real database, so files must not run side by side.
    fileParallelism: false,
  },
});
