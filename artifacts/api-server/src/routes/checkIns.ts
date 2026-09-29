import { UndoCheckInParams, UndoCheckInResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { sendJson } from "../lib/http";
import { requireStaff, staffOf } from "../middlewares/requireStaff";
import { undoCheckIn } from "../services/checkIns";

const router: IRouter = Router();

router.delete(
  "/check-ins/:eventId/:studentId",
  requireStaff,
  async (req, res) => {
    const { eventId, studentId } = UndoCheckInParams.parse(req.params);
    const registration = await undoCheckIn(staffOf(req), eventId, studentId);
    sendJson(res, UndoCheckInResponse, registration);
  },
);

export default router;
