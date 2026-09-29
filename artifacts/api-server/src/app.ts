import { pool } from "@workspace/db";
import compression from "compression";
import connectPgSimple from "connect-pg-simple";
import express, { type Express, type RequestHandler } from "express";
import session from "express-session";
import helmet from "helmet";
import pinoHttp from "pino-http";
import {
  CARD_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  TRUST_PROXY_HOPS,
  isProduction,
  type RateLimit,
} from "./config";
import { logger } from "./lib/logger";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { createRateLimiter } from "./middlewares/rateLimits";
import { createRouter } from "./routes";

export interface AppOptions {
  /** Override the defaults in config.ts (tests use this). */
  loginRateLimit?: RateLimit;
  cardRateLimit?: RateLimit;
  trustProxyHops?: number;
  /** Mark the session cookie `Secure` (HTTPS only). Default: in production. */
  secureCookies?: boolean;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET must be set in production (refusing to start with a default).",
    );
  }
  return "development-only-session-secret";
}

/** Responses carry personal data and per-user state: never let anything cache them. */
const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

export function createApp(options: AppOptions = {}): Express {
  const app: Express = express();

  // Behind Replit's proxy: needed so `secure` cookies are set over the proxied
  // HTTPS connection and so rate limits see the client's address (see config.ts).
  app.set("trust proxy", options.trustProxyHops ?? TRUST_PROXY_HOPS);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );
  app.use(helmet());
  app.use(compression());
  // A full batch of scans (MAX_SCANS_PER_REQUEST) is a few dozen KB; anything
  // near this limit is not a real request.
  app.use(express.json({ limit: "1mb" }));

  const PgStore = connectPgSimple(session);
  const api = express.Router();
  api.use(noStore);
  api.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: sessionSecret(),
      store: new PgStore({ pool, tableName: "sessions" }),
      resave: false,
      saveUninitialized: false,
      // Sliding: every request pushes the expiry out by the idle timeout.
      rolling: true,
      cookie: {
        httpOnly: true,
        // Lax keeps the cookie off cross-site POST/DELETE requests (CSRF).
        sameSite: "lax",
        secure: options.secureCookies ?? isProduction,
        maxAge: SESSION_IDLE_TIMEOUT_MS,
      },
    }),
  );
  api.use(
    createRouter({
      loginLimiter: createRateLimiter(
        options.loginRateLimit ?? LOGIN_RATE_LIMIT,
        { countSuccessfulRequests: false },
      ),
      cardLimiter: createRateLimiter(options.cardRateLimit ?? CARD_RATE_LIMIT),
    }),
  );
  api.use(notFound);

  app.use("/api", api);
  app.use(errorHandler);

  return app;
}
