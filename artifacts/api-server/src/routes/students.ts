import {
  SetStudentNoteBody,
  SetStudentNoteParams,
  SetStudentNoteResponse,
} from "@workspace/api-zod";
import { normalizeStudentId } from "@workspace/attendance";
import { Router, type IRouter } from "express";
import { parseRequest, sendJson } from "../lib/http";
import { requireStaff, staffOf } from "../middlewares/requireStaff";
import { setStudentNote } from "../services/students";

const router: IRouter = Router();

// Every staff member may add or change a note; there is nothing to gate.
router.put("/students/:studentId/note", requireStaff, async (req, res) => {
  const { studentId } = parseRequest(SetStudentNoteParams, req.params);
  const { note } = parseRequest(SetStudentNoteBody, req.body);
  sendJson(
    res,
    SetStudentNoteResponse,
    await setStudentNote(staffOf(req).id, normalizeStudentId(studentId), note),
  );
});

export default router;
