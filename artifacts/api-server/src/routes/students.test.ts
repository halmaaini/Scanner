import { expect, it } from "vitest";
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
});
