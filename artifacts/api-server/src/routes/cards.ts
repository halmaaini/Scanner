import { GetCardParams, GetCardResponse } from "@workspace/api-zod";
import { Router, type IRouter, type RequestHandler } from "express";
import { HttpError, parseRequest, sendJson } from "../lib/http";
import { getCard } from "../services/cards";

/** Public route: `limiter` is the only thing standing in front of it. */
export function createCardsRouter(limiter: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.get("/cards/:studentId", limiter, async (req, res) => {
    const { studentId } = parseRequest(GetCardParams, req.params);
    const card = await getCard(studentId);
    if (!card) throw new HttpError(404, "Student not found");
    sendJson(res, GetCardResponse, card);
  });

  return router;
}
