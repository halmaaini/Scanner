import { expect, it } from "vitest";
import {
  addStaff,
  createClient,
  describeWithDb,
  signIn,
} from "../testing/helpers";

describeWithDb("errors and headers", () => {
  it("serves the health check", async () => {
    const res = await createClient().get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers unknown API paths with a JSON 404", async () => {
    const res = await createClient().get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("answers malformed JSON with a JSON 400", async () => {
    const res = await createClient()
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Malformed JSON" });
  });

  it("refuses oversized bodies", async () => {
    await addStaff("sara");
    const client = createClient();
    await signIn(client, "sara");
    const res = await client
      .post("/api/scans")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ pad: "x".repeat(1_100_000) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request too large" });
  });

  it("never lets responses be cached and sets basic security headers", async () => {
    const res = await createClient().get("/api/healthz");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
