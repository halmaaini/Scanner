import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorHandler } from "../middlewares/errorHandler";
import { HttpError, parseRequest, sendJson } from "./http";

const Body = z.object({ name: z.string(), count: z.number() });

// A minimal app with the real error handler, so these tests need no database.
function appWith(route: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.post("/", route);
  app.use(errorHandler);
  return app;
}

describe("parseRequest", () => {
  const app = appWith((req, res) => {
    const { name, count } = parseRequest(Body, req.body);
    res.json({ name, twice: count * 2 });
  });

  it("returns the parsed data", async () => {
    const res = await request(app).post("/").send({ name: "a", count: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "a", twice: 4 });
  });

  it("answers a body that does not fit with a 400 naming the field", async () => {
    const res = await request(app).post("/").send({ name: "a", count: "two" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Invalid request \(count\): /);
  });
});

describe("sendJson", () => {
  it("answers 500, not 400, when our own response breaks the contract", async () => {
    const app = appWith((_req, res) => {
      // Simulates a service returning something the API spec does not allow.
      sendJson(res, Body, { name: "a", count: "many" } as never);
    });
    const res = await request(app).post("/").send({});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("lets an HttpError through with its own status", async () => {
    const app = appWith(() => {
      throw new HttpError(418, "Short and stout");
    });
    const res = await request(app).post("/").send({});
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: "Short and stout" });
  });
});
