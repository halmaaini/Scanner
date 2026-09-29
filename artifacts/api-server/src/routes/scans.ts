import { SubmitScansBody, SubmitScansResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { sendJson } from "../lib/http";
import { requireStaff, staffOf } from "../middlewares/requireStaff";
import { recordScans } from "../services/scans";

const router: IRouter = Router();

router.post("/scans", requireStaff, async (req, res) => {
  const { scans } = SubmitScansBody.parse(req.body);
  const results = await recordScans(staffOf(req), scans);
  sendJson(res, SubmitScansResponse, { results });
});

export default router;
