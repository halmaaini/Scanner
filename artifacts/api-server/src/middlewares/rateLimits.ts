import { rateLimit } from "express-rate-limit";
import type { RateLimit } from "../config";

/**
 * Per-client request limiter that answers with the API's normal error body.
 * Counts are kept in memory, so with several server instances each one
 * counts separately; that is enough to blunt guessing and floods.
 */
export function createRateLimiter(
  { windowMs, limit }: RateLimit,
  options: { countSuccessfulRequests?: boolean } = {},
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: !(options.countSuccessfulRequests ?? true),
    handler: (_req, res) => {
      res.status(429).json({ error: "Too many requests. Try again later." });
    },
  });
}
