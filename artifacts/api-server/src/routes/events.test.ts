import { expect, it } from "vitest";
import {
  addEvent,
  addStaff,
  createClient,
  describeWithDb,
  signIn,
} from "../testing/helpers";

const switchEvent = (
  client: ReturnType<typeof createClient>,
  isOpen: boolean,
  eventId = "graduation",
) => client.patch(`/api/events/${eventId}`).send({ isOpen });

async function signedInAs(username: string, role: "admin" | "super") {
  await addStaff(username, { role });
  const client = createClient();
  await signIn(client, username);
  return client;
}

describeWithDb("open or close an event", () => {
  it("is for signed-in staff only", async () => {
    await addEvent("graduation");
    expect((await switchEvent(createClient(), false)).status).toBe(401);
  });

  it("lets the super admin close and reopen an event", async () => {
    await addEvent("graduation", { isOpen: true });
    const client = await signedInAs("boss", "super");

    const closed = await switchEvent(client, false);
    expect(closed.status).toBe(200);
    expect(closed.body).toMatchObject({ id: "graduation", isOpen: false });
    // Doing it again is harmless.
    expect((await switchEvent(client, false)).body.isOpen).toBe(false);
    expect((await switchEvent(client, true)).body.isOpen).toBe(true);
  });

  it("keeps plain admins out, and changes nothing", async () => {
    await addEvent("graduation", { isOpen: true });
    const client = await signedInAs("sara", "admin");

    expect((await switchEvent(client, false)).status).toBe(403);
    const roster = await client.get("/api/roster");
    expect(roster.body.events[0].isOpen).toBe(true);
  });

  it("answers 404 for an event that does not exist and 400 for a bad body", async () => {
    const client = await signedInAs("boss", "super");
    expect((await switchEvent(client, true, "nope")).status).toBe(404);
    expect(
      (await client.patch("/api/events/graduation").send({ isOpen: "yes" }))
        .status,
    ).toBe(400);
  });
});
