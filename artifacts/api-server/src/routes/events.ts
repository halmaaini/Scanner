import {
  SetEventOpenBody,
  SetEventOpenParams,
  SetEventOpenResponse,
} from "@workspace/api-zod";
import { can } from "@workspace/attendance";
import { Router, type IRouter } from "express";
import { HttpError, parseRequest, sendJson } from "../lib/http";
import { requireStaff, staffOf } from "../middlewares/requireStaff";
import { setEventOpen } from "../services/events";

const router: IRouter = Router();

router.patch("/events/:eventId", requireStaff, async (req, res) => {
  const staff = staffOf(req);
  if (!can(staff.role, "manage_events")) {
    throw new HttpError(403, "Only the super admin can open or close events");
  }
  const { eventId } = parseRequest(SetEventOpenParams, req.params);
  const { isOpen } = parseRequest(SetEventOpenBody, req.body);
  sendJson(
    res,
    SetEventOpenResponse,
    await setEventOpen(staff.id, eventId, isOpen),
  );
});

export default router;
