import { expect, it } from "vitest";
import {
  addEvent,
  addStaff,
  addStudent,
  createClient,
  describeWithDb,
  register,
  registrationOf,
  signIn,
} from "../testing/helpers";

async function setup() {
  const sara = await addStaff("sara", { role: "admin" });
  const omar = await addStaff("omar", { role: "admin" });
  const boss = await addStaff("boss", { role: "super" });
  await addEvent("graduation");
  await addStudent("1001");
  return { sara, omar, boss };
}

const undo = (client: ReturnType<typeof createClient>, student = "1001") =>
  client.delete(`/api/check-ins/graduation/${student}`);

describeWithDb("undo check-in", () => {
  it("is for signed-in staff only", async () => {
    await setup();
    expect((await undo(createClient())).status).toBe(401);
  });

  it("lets an admin undo their own check-in and keeps the student registered", async () => {
    const { sara } = await setup();
    await register("1001", "graduation", { by: sara });
    const client = createClient();
    await signIn(client, "sara");

    const res = await undo(client);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      studentId: "1001",
      eventId: "graduation",
      checkedInAt: null,
      checkedInBy: null,
    });
    expect(await registrationOf("1001", "graduation")).toEqual({
      checkedInAt: null,
      checkedInBy: null,
    });
  });

  it("stops an admin undoing someone else's check-in", async () => {
    const { omar } = await setup();
    await register("1001", "graduation", { by: omar });
    const client = createClient();
    await signIn(client, "sara");

    const res = await undo(client);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "You can only undo check-ins you made" });
    expect((await registrationOf("1001", "graduation")).checkedInBy).toBe(omar);
  });

  it("lets the super admin undo anyone's", async () => {
    const { omar } = await setup();
    await register("1001", "graduation", { by: omar });
    const client = createClient();
    await signIn(client, "boss");

    expect((await undo(client)).status).toBe(200);
    expect((await registrationOf("1001", "graduation")).checkedInAt).toBeNull();
  });

  it("succeeds without changing anything when there is nothing to undo", async () => {
    await setup();
    await register("1001", "graduation");
    const client = createClient();
    await signIn(client, "sara");

    const res = await undo(client);
    expect(res.status).toBe(200);
    expect(res.body.checkedInAt).toBeNull();
    // Even for someone who could never undo it: a clear check-in is not theirs to protect.
    expect((await undo(client)).status).toBe(200);
  });

  it("answers 404 for a student who is not registered for the event", async () => {
    await setup();
    const client = createClient();
    await signIn(client, "sara");

    expect((await undo(client, "9999")).status).toBe(404);
    expect((await client.delete("/api/check-ins/nope/1001")).status).toBe(404);
  });

  it("understands the same ID variants as scanning", async () => {
    const { sara } = await setup();
    await addStudent("2021", "Arabic digits");
    await register("2021", "graduation", { by: sara });
    const client = createClient();
    await signIn(client, "sara");

    expect((await undo(client, encodeURIComponent("٢٠٢١"))).status).toBe(200);
    expect((await registrationOf("2021", "graduation")).checkedInAt).toBeNull();
  });
});
