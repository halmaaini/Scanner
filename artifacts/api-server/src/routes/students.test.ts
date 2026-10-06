import { expect, it } from "vitest";
import { pool } from "@workspace/db";
import {
  addEvent,
  addStaff,
  addStudent,
  createClient,
  describeWithDb,
  register,
  scan,
  signIn,
} from "../testing/helpers";

const putNote = (
  client: ReturnType<typeof createClient>,
  note: string | null,
  studentId = "1001",
) => client.put(`/api/students/${studentId}/note`).send({ note });

async function signedInAs(username: string, role: "admin" | "super") {
  await addStaff(username, { role });
  const client = createClient();
  await signIn(client, username);
  return client;
}

describeWithDb("student notes", () => {
  it("is for signed-in staff only", async () => {
    await addStudent("1001");
    expect((await putNote(createClient(), "hi")).status).toBe(401);
  });

  it("lets any staff member set, replace and clear the one note", async () => {
    await addStudent("1001");
    const admin = await signedInAs("sara", "admin");

    expect(
      (await putNote(admin, "Needs a wheelchair ramp")).body,
    ).toMatchObject({ studentId: "1001", note: "Needs a wheelchair ramp" });
    expect(
      (await putNote(admin, "  Collects the trophy for a friend ")).body.note,
    ).toBe("Collects the trophy for a friend");
    expect((await putNote(admin, "")).body.note).toBeNull();
    expect((await putNote(admin, null)).body.note).toBeNull();
  });

  it("is read from a typed ID the way scans are, and 404s for an unknown student", async () => {
    await addStudent("1001");
    const admin = await signedInAs("sara", "admin");
    expect((await putNote(admin, "x", "nobody")).status).toBe(404);
    expect((await putNote(admin, "x".repeat(301))).status).toBe(400);
  });

  it("shows up in the roster and the scan result, never blocks a check-in, and stays off the public card", async () => {
    await addEvent("graduation");
    await addStudent("1001");
    await register("1001", "graduation");
    const admin = await signedInAs("sara", "admin");
    await putNote(admin, "Parent is waiting at the gate");

    const roster = await admin.get("/api/roster");
    expect(roster.body.students[0].note).toBe("Parent is waiting at the gate");

    const result = await admin
      .post("/api/scans")
      .send({ scans: [scan("1001", "graduation")] });
    expect(result.body.results[0]).toMatchObject({
      outcome: "checked_in",
      student: { note: "Parent is waiting at the gate" },
    });

    const card = await createClient().get("/api/cards/1001");
    expect(card.status).toBe(200);
    expect(JSON.stringify(card.body)).not.toContain("gate");
    expect(card.body).not.toHaveProperty("note");
  });

  it("keeps seats unique and well formed in the database", async () => {
    await addStudent("1001");
    await addStudent("1002");
    const seat = (id: string, row: string | null, no: number | null) =>
      pool.query(
        "update students set seat_row = $2, seat_number = $3 where student_id = $1",
        [id, row, no],
      );

    await seat("1001", "F", 7);
    await expect(seat("1002", "F", 7)).rejects.toThrow(/students_seat_key/);
    await expect(seat("1002", "F", null)).rejects.toThrow(
      /students_seat_check/,
    );
    await expect(seat("1002", "f", 7)).rejects.toThrow(/students_seat_check/);
    await expect(seat("1002", "FF", 7)).rejects.toThrow(/students_seat_check/);
    await expect(seat("1002", "F", 0)).rejects.toThrow(/students_seat_check/);
    // Two students without a seat are fine, and a seat can be given up.
    await seat("1001", null, null);
    await seat("1002", null, null);
  });

  it("sends the seat to staff in the roster and on a scan result", async () => {
    await addEvent("graduation");
    await addStudent("1001");
    await register("1001", "graduation");
    await pool.query(
      "update students set seat_row = 'A', seat_number = 12 where student_id = '1001'",
    );
    const admin = await signedInAs("sara", "admin");

    const roster = await admin.get("/api/roster");
    expect(roster.body.students[0]).toMatchObject({
      seatRow: "A",
      seatNumber: 12,
    });
    const result = await admin
      .post("/api/scans")
      .send({ scans: [scan("1001", "graduation")] });
    expect(result.body.results[0].student).toMatchObject({
      seatRow: "A",
      seatNumber: 12,
    });
  });
});
