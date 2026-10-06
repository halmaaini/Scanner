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

  const change = (client: ReturnType<typeof createClient>, body: object) =>
    client.patch("/api/events/graduation").send(body);

  it("lets the super admin set, change and clear when and where", async () => {
    await addEvent("graduation");
    const client = await signedInAs("boss", "super");

    const set = await change(client, {
      startsAt: "2026-06-11T09:00:00.000Z",
      venue: "Main hall",
      mapUrl: "https://maps.example.com/hall",
    });
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({
      startsAt: "2026-06-11T09:00:00.000Z",
      venue: "Main hall",
      mapUrl: "https://maps.example.com/hall",
      isOpen: true,
    });

    // Only what is sent changes.
    const renamed = await change(client, { venue: "Hall B" });
    expect(renamed.body).toMatchObject({
      venue: "Hall B",
      mapUrl: "https://maps.example.com/hall",
    });

    const cleared = await change(client, {
      startsAt: null,
      venue: "  ",
      mapUrl: "",
    });
    expect(cleared.body).toMatchObject({
      startsAt: null,
      venue: null,
      mapUrl: null,
    });
  });

  it("refuses a map link that is not a web link, and treats an empty change as nothing to do", async () => {
    await addEvent("graduation");
    const client = await signedInAs("boss", "super");
    expect(
      (await change(client, { mapUrl: "javascript:alert(1)" })).status,
    ).toBe(400);
    expect((await change(client, {})).status).toBe(200);
    expect((await change(client, { mapUrl: "ftp://x.test/a" })).status).toBe(
      400,
    );
  });

  it("keeps plain admins from changing details", async () => {
    await addEvent("graduation");
    const client = await signedInAs("sara", "admin");
    expect((await change(client, { venue: "Hall" })).status).toBe(403);
  });

  it("lets the super admin switch the seating plan on and off for an event", async () => {
    await addEvent("graduation");
    const client = await signedInAs("boss", "super");
    expect((await change(client, { hasSeating: true })).body.hasSeating).toBe(
      true,
    );
    expect((await change(client, { hasSeating: false })).body.hasSeating).toBe(
      false,
    );
  });
});
