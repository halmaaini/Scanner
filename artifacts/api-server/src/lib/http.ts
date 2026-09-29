import type { Response } from "express";
import type { ZodType, z } from "zod";

/** An error that should reach the client as `{ error: message }` with `status`. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/**
 * Sends `data` as JSON after checking it against the generated response
 * schema, so the server can never drift from the OpenAPI contract: a mismatch
 * is a 500 in development and tests, not a silently wrong payload.
 */
export function sendJson<S extends ZodType>(
  res: Response,
  schema: S,
  data: z.input<S>,
  status = 200,
): void {
  res.status(status).json(schema.parse(data));
}
