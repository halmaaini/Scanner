import {
  UpdateEventBody,
  UpdateEventParams,
  UpdateEventResponse,
} from "@workspace/api-zod";
import { can } from "@workspace/attendance";
import { Router, type IRouter } from "express";
import { HttpError, parseRequest, sendJson } from "../lib/http";
import { requireStaff, staffOf } from "../middlewares/requireStaff";
import { updateEvent } from "../services/events";

const router: IRouter = Router();

router.patch("/events/:eventId", requireStaff, async (req, res) => {
  const staff = staffOf(req);
  if (!can(staff.role, "manage_events")) {
    throw new HttpError(403, "Only the super admin can change events");
  }
  const { eventId } = parseRequest(UpdateEventParams, req.params);
  const change = parseRequest(UpdateEventBody, req.body);
  sendJson(
    res,
    UpdateEventResponse,
    await updateEvent(staff.id, eventId, change),
  );
});

export default router;
