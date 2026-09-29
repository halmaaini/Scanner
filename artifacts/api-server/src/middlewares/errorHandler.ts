import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http";

/** Unknown /api paths get the normal error body instead of Express's HTML page. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

interface BodyParserError {
  type?: string;
  status?: number;
}

/**
 * The one place errors become responses, always as `{ error: string }`.
 * Express 5 sends rejected async handlers here, so routes just throw.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path.join(".");
    res.status(400).json({
      error: issue
        ? `Invalid request${where ? ` (${where})` : ""}: ${issue.message}`
        : "Invalid request",
    });
    return;
  }

  // Malformed or oversized JSON rejected by express.json().
  const parserError = err as BodyParserError;
  if (parserError.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON" });
    return;
  }
  if (parserError.type === "entity.too.large") {
    res.status(413).json({ error: "Request too large" });
    return;
  }

  req.log?.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
};
