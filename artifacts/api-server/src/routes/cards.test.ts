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
      seatRow: null,
      seatNumber: null,
      neighbours: [],
      occupiedSeats: [],
      isActive: true,
      events: [
        {
          id: "rehearsal",
          name: "Rehearsal",
          sortOrder: 1,
          startsAt: null,
          venue: null,
          mapUrl: null,
          hasSeating: false,
          checkedInAt: "2026-06-11T09:14:00.000Z",
        },
        {
          id: "graduation",
          name: "Graduation",
          sortOrder: 2,
          startsAt: null,
          venue: null,
          mapUrl: null,
          hasSeating: false,
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

  it("shows the student's seat and which events show the plan", async () => {
    await addEvent("rehearsal", { name: "Rehearsal", sortOrder: 1 });
    await addEvent("trophy", { name: "Trophy", sortOrder: 2 });
    await pool.query(
      "update events set has_seating = true where id = 'rehearsal'",
    );
    await addStudent("1001");
    await pool.query(
      "update students set seat_row = 'F', seat_number = 7 where student_id = '1001'",
    );
    await register("1001", "rehearsal");
    await register("1001", "trophy");

    const res = await createClient().get("/api/cards/1001");
    expect(res.body).toMatchObject({ seatRow: "F", seatNumber: 7 });
    expect(
      res.body.events.map((e: { id: string; hasSeating: boolean }) => [
        e.id,
        e.hasSeating,
      ]),
    ).toEqual([
      ["rehearsal", true],
      ["trophy", false],
    ]);
  });

  it("names the neighbours in the same block and lists the taken seats, for the procession", async () => {
    await addEvent("graduation", { name: "Graduation" });
    await pool.query("update events set has_seating = true");
    const seat = (id: string, row: string, no: number, active = true) =>
      addStudent(id, `Student ${row}${no}`, active).then(() =>
        pool.query(
          "update students set seat_row = $2, seat_number = $3 where student_id = $1",
          [id, row, no],
        ),
      );
    await seat("1001", "A", 9);
    await seat("1002", "A", 8);
    await seat("1003", "A", 10); // across the aisle: not a neighbour
    await seat("1004", "B", 9); // the row behind: not a neighbour
    await seat("1005", "C", 1, false); // revoked: does not march
    await register("1001", "graduation");

    const res = await createClient().get("/api/cards/1001");
    expect(res.body.neighbours).toEqual([
      { seatRow: "A", seatNumber: 8, fullName: "Student A8" },
    ]);
    expect(res.body.occupiedSeats).toEqual([
      { seatRow: "A", seatNumber: 8 },
      { seatRow: "A", seatNumber: 9 },
      { seatRow: "A", seatNumber: 10 },
      { seatRow: "B", seatNumber: 9 },
    ]);
  });

  it("sends no seating extras when none of the student's events shows the plan", async () => {
    await addEvent("trophy");
    await addStudent("1001");
    await pool.query(
      "update students set seat_row = 'A', seat_number = 1 where student_id = '1001'",
    );
    await register("1001", "trophy");
    const res = await createClient().get("/api/cards/1001");
    expect(res.body).toMatchObject({ neighbours: [], occupiedSeats: [] });
  });
});
