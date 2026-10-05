import { pool } from "@workspace/db";
import { expect, it } from "vitest";
import {
  addEvent,
  addStaff,
  addStudent,
  createClient,
  describeWithDb,
  register,
} from "../testing/helpers";

describeWithDb("cards", () => {
  it("shows a card without signing in, listing only the events the student is on", async () => {
    const sara = await addStaff("sara");
    await addEvent("graduation", { name: "Graduation", sortOrder: 2 });
    await addEvent("rehearsal", { name: "Rehearsal", sortOrder: 1 });
    await addEvent("trophy", { name: "Trophy", sortOrder: 3 });
    await addStudent("1001", "Layla Hassan");
    await register("1001", "graduation");
    await register("1001", "rehearsal", {
      by: sara,
      at: "2026-06-11T09:14:00.000Z",
    });

    const res = await createClient().get("/api/cards/1001");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({
      studentId: "1001",
      fullName: "Layla Hassan",
      major: null,
      isActive: true,
      events: [
        {
          id: "rehearsal",
          name: "Rehearsal",
          sortOrder: 1,
          startsAt: null,
          venue: null,
          mapUrl: null,
          checkedInAt: "2026-06-11T09:14:00.000Z",
        },
        {
          id: "graduation",
          name: "Graduation",
          sortOrder: 2,
          startsAt: null,
          venue: null,
          mapUrl: null,
          checkedInAt: null,
        },
      ],
    });
  });

  it("never reveals who checked a student in", async () => {
    const sara = await addStaff("sara", { displayName: "Sara" });
    await addEvent("graduation");
    await addStudent("1001");
    await register("1001", "graduation", { by: sara });

    const res = await createClient().get("/api/cards/1001");
    expect(JSON.stringify(res.body)).not.toMatch(/Sara|checkedInBy|staff/);
  });

  it("marks a revoked student", async () => {
    await addStudent("1001", "Karim", false);
    const res = await createClient().get("/api/cards/1001");
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("answers 404 for an unknown ID", async () => {
    const res = await createClient().get("/api/cards/9999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Student not found" });
  });

  it("understands IDs typed with Arabic digits", async () => {
    await addStudent("2021", "Layla");
    const res = await createClient().get(
      `/api/cards/${encodeURIComponent("٢٠٢١")}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe("2021");
  });

  it("limits requests per client", async () => {
    await addStudent("1001");
    const client = createClient({
      cardRateLimit: { windowMs: 60_000, limit: 3 },
    });

    for (let i = 0; i < 3; i++) {
      expect((await client.get("/api/cards/1001")).status).toBe(200);
    }
    const blocked = await client.get("/api/cards/1001");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: "Too many requests. Try again later.",
    });
  });

  it("shows when and where each event is, without the open flag", async () => {
    await addEvent("graduation", { name: "Graduation" });
    await pool.query(
      "update events set starts_at = $1, venue = $2, map_url = $3",
      ["2026-06-12T08:30:00.000Z", "Main hall", "https://maps.example.com/h"],
    );
    await addStudent("1001");
    await register("1001", "graduation");

    const res = await createClient().get("/api/cards/1001");
    expect(res.body.events[0]).toMatchObject({
      startsAt: "2026-06-12T08:30:00.000Z",
      venue: "Main hall",
      mapUrl: "https://maps.example.com/h",
    });
    expect(res.body.events[0]).not.toHaveProperty("isOpen");
  });
});
