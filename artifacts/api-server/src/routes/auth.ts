import {
  GetCurrentStaffResponse,
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import type { Request } from "express";
import { Router, type IRouter, type RequestHandler } from "express";
import { SESSION_COOKIE_NAME } from "../config";
import { HttpError, parseRequest, sendJson } from "../lib/http";
import { requireStaff, staffOf } from "../middlewares/requireStaff";
import { verifyCredentials } from "../services/auth";

const regenerate = (req: Request) =>
  new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
const save = (req: Request) =>
  new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
const destroy = (req: Request) =>
  new Promise<void>((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve())),
  );

/** `loginLimiter` counts failed attempts only; see createApp. */
export function createAuthRouter(loginLimiter: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.post("/auth/login", loginLimiter, async (req, res) => {
    const { username, password } = parseRequest(LoginBody, req.body);

    const staff = await verifyCredentials(username, password);
    if (!staff) throw new HttpError(401, "Invalid username or password");

    // A fresh session id at every sign-in, so an id planted before login is useless.
    await regenerate(req);
    req.session.staffId = staff.id;
    await save(req);

    sendJson(res, LoginResponse, { staff });
  });

  router.post("/auth/logout", async (req, res) => {
    await destroy(req);
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(204).end();
  });

  router.get("/auth/me", requireStaff, (req, res) => {
    sendJson(res, GetCurrentStaffResponse, { staff: staffOf(req) });
  });

  return router;
}
