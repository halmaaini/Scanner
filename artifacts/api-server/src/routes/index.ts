import { Router, type IRouter, type RequestHandler } from "express";
import { createAuthRouter } from "./auth";
import checkInsRouter from "./checkIns";
import { createCardsRouter } from "./cards";
import eventsRouter from "./events";
import healthRouter from "./health";
import rosterRouter from "./roster";
import scansRouter from "./scans";
import studentsRouter from "./students";

export interface RouterOptions {
  /** Guards POST /auth/login; counts failed attempts only. */
  loginLimiter: RequestHandler;
  /** Guards the public GET /cards/:studentId. */
  cardLimiter: RequestHandler;
}

export function createRouter({
  loginLimiter,
  cardLimiter,
}: RouterOptions): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);
  router.use(createAuthRouter(loginLimiter));
  router.use(rosterRouter);
  router.use(scansRouter);
  router.use(checkInsRouter);
  router.use(eventsRouter);
  router.use(studentsRouter);
  router.use(createCardsRouter(cardLimiter));

  return router;
}
