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
 * Reads a request's body or parameters with a generated schema. Anything that
 * does not fit is the client's mistake: a 400 that names the first bad field.
 * (Do not call `schema.parse` in a route: a ZodError is not a client error
 * everywhere, see `sendJson`.)
 */
export function parseRequest<S extends ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const field = issue?.path.join(".");
  throw new HttpError(
    400,
    issue
      ? `Invalid request${field ? ` (${field})` : ""}: ${issue.message}`
      : "Invalid request",
  );
}

/**
 * Sends `data` as JSON after checking it against the generated response
 * schema, so the server can never drift from the OpenAPI contract. A mismatch
 * is a bug on our side: it throws, and the error handler answers 500 rather
 * than sending a silently wrong payload (or blaming the client with a 400).
 */
export function sendJson<S extends ZodType>(
  res: Response,
  schema: S,
  data: z.input<S>,
  status = 200,
): void {
  res.status(status).json(schema.parse(data));
}
