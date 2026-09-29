import { GetRosterResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { sendJson } from "../lib/http";
import { requireStaff } from "../middlewares/requireStaff";
import { getRoster } from "../services/roster";

const router: IRouter = Router();

router.get("/roster", requireStaff, async (_req, res) => {
  sendJson(res, GetRosterResponse, await getRoster());
});

export default router;
