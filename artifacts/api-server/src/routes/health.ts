import { HealthCheckResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { sendJson } from "../lib/http";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  sendJson(res, HealthCheckResponse, { status: "ok" });
});

export default router;
