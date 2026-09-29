import path from "node:path";
import { pool, runMigrations } from "@workspace/db";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Bring the database up to date before serving anything. `build.mjs` copies
// the migrations next to the bundle; the same code runs in development and
// production, so there is no separate migration step to forget.
try {
  const outcome = await runMigrations(path.join(__dirname, "migrations"));
  logger.info({ outcome }, "Database migrations are up to date");
  if (outcome === "adopted") {
    // Replit copies the development database's tables to production when
    // publishing, so the migrations had nothing left to create.
    logger.info(
      "The tables were already in place; the migrations were recorded, not run",
    );
  }
} catch (err) {
  logger.error({ err }, "Database migration failed");
  process.exit(1);
}

const app = createApp();

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Let in-flight requests finish and release database connections when the
// platform stops the instance.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}
