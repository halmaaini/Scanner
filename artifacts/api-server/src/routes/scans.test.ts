import { MAX_SCANS_PER_REQUEST } from "@workspace/attendance";
import { expect, it } from "vitest";
import {
  addEvent,
  addStaff,
  addStudent,
  createClient,
  describeWithDb,
  register,
  registrationOf,
  scan,
  signIn,
} from "../testing/helpers";

async function signedInAs(username: string) {
  const id = await addStaff(username, { displayName: username });
  const client = createClient();
  await signIn(client, username);
  return { id, client };
}

describeWithDb("scans", () => {
  it("is for signed-in staff only", async () => {
    const res = await createClient()
      .post("/api/scans")
      .send({ scans: [scan("1001", "graduation")] });
    expect(res.status).toBe(401);
  });

  it("checks a registered student in and records who and when", async () => {
    const { id, client } = await signedInAs("sara");
    await addEvent("graduation");
    await addStudent("1001", "Layla Hassan");
    await register("1001", "graduation");

    const s = scan("1001", "graduation", {
      scannedAt: "2026-06-12T10:42:00.000Z",
    });
    const res = await client.post("/api/scans").send({ scans: [s] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      {
        id: s.id,
        outcome: "checked_in",
        studentId: "1001",
        eventId: "graduation",
        student: {
          studentId: "1001",
          fullName: "Layla Hassan",
          isActive: true,
        },
        registration: {
          studentId: "1001",
          eventId: "graduation",
          checkedInAt: "2026-06-12T10:42:00.000Z",
          checkedInBy: id,
        },
      },
    ]);
    const stored = await registrationOf("1001", "graduation");
    expect(stored.checkedInBy).toBe(id);
    expect(stored.checkedInAt?.toISOString()).toBe("2026-06-12T10:42:00.000Z");
  });

  it("reports a repeat scan and changes nothing", async () => {
    const { client } = await signedInAs("sara");
    const omar = await addStaff("omar", { displayName: "Omar" });
    await addEvent("graduation");
    await addStudent("1001");
    await register("1001", "graduation", {
      by: omar,
      at: "2026-06-12T09:00:00.000Z",
    });

    const res = await client
      .post("/api/scans")
      .send({ scans: [scan("1001", "graduation")] });

    const [result] = res.body.results;
    expect(result.outcome).toBe("already_checked_in");
    expect(result.registration).toEqual({
      studentId: "1001",
      eventId: "graduation",
      checkedInAt: "2026-06-12T09:00:00.000Z",
      checkedInBy: omar,
    });
    expect((await registrationOf("1001", "graduation")).checkedInBy).toBe(omar);
  });

  it("gives every kind of refusal its own outcome, with no registration", async () => {
    const { client } = await signedInAs("sara");
    await addEvent("graduation");
    await addEvent("trophy");
    await addStudent("1001", "Layla");
    await addStudent("1002", "Karim", false);
    await register("1001", "graduation");
    await register("1002", "graduation");

    const scans = [
      scan("9999", "graduation"), // no such student
      scan("1001", "nope"), // no such event
      scan("1001", "trophy"), // not on the trophy list
      scan("1002", "graduation"), // revoked
    ];
    const res = await client.post("/api/scans").send({ scans });

    expect(res.body.results.map((r: { outcome: string }) => r.outcome)).toEqual(
      ["unknown_student", "unknown_event", "not_registered", "revoked"],
    );
    expect(
      res.body.results.map((r: { registration: unknown }) => r.registration),
    ).toEqual([null, null, null, null]);
    expect(res.body.results[0].student).toBeNull();
    expect(res.body.results[3].student).toEqual({
      studentId: "1002",
      fullName: "Karim",
      isActive: false,
    });
    // Nothing was recorded.
    expect((await registrationOf("1001", "graduation")).checkedInAt).toBeNull();
    expect((await registrationOf("1002", "graduation")).checkedInAt).toBeNull();
  });

  it("matches IDs typed with Arabic digits, spaces or direction marks", async () => {
    const { client } = await signedInAs("sara");
    await addEvent("graduation");
    await addStudent("2021045", "Layla");
    await register("2021045", "graduation");

    const res = await client
      .post("/api/scans")
      .send({ scans: [scan(" ٢٠٢١\u200f045 ", "graduation")] });

    expect(res.body.results[0]).toMatchObject({
      outcome: "checked_in",
      studentId: "2021045",
    });
  });

  it("judges scans in order, so a repeat inside one batch is caught", async () => {
    const { client } = await signedInAs("sara");
    await addEvent("graduation");
    await addStudent("1001");
    await addStudent("1002");
    await register("1001", "graduation");
    await register("1002", "graduation");

    const res = await client.post("/api/scans").send({
      scans: [
        scan("1001", "graduation"),
        scan("1002", "graduation"),
        scan("1001", "graduation"),
      ],
    });

    expect(res.body.results.map((r: { outcome: string }) => r.outcome)).toEqual(
      ["checked_in", "checked_in", "already_checked_in"],
    );
  });

  it("answers each scan with its own id so a queue can be matched up", async () => {
    const { client } = await signedInAs("sara");
    await addEvent("graduation");
    const scans = [scan("1", "graduation"), scan("2", "graduation")];
    const res = await client.post("/api/scans").send({ scans });
    expect(res.body.results.map((r: { id: string }) => r.id)).toEqual(
      scans.map((s) => s.id),
    );
  });

  it("keeps the time of an earlier (offline) scan but never a future one", async () => {
    const { client } = await signedInAs("sara");
    await addEvent("graduation");
    await addStudent("1001");
    await addStudent("1002");
    await register("1001", "graduation");
    await register("1002", "graduation");

    const past = "2026-01-01T08:00:00.000Z";
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const before = Date.now();
    await client.post("/api/scans").send({
      scans: [
        scan("1001", "graduation", { scannedAt: past }),
        scan("1002", "graduation", { scannedAt: future }),
      ],
    });

    expect(
      (await registrationOf("1001", "graduation")).checkedInAt?.toISOString(),
    ).toBe(past);
    const clamped = (
      await registrationOf("1002", "graduation")
    ).checkedInAt!.getTime();
    expect(clamped).toBeGreaterThanOrEqual(before - 1000);
    expect(clamped).toBeLessThanOrEqual(Date.now());
  });

  it("lets exactly one of many simultaneous scans win", async () => {
    const { id, client } = await signedInAs("sara");
    await addEvent("graduation");
    await addStudent("1001");
    await register("1001", "graduation");

    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        client.post("/api/scans").send({ scans: [scan("1001", "graduation")] }),
      ),
    );
    const outcomes = responses.map((r) => r.body.results[0].outcome as string);

    expect(outcomes.filter((o) => o === "checked_in")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "already_checked_in")).toHaveLength(11);
    expect((await registrationOf("1001", "graduation")).checkedInBy).toBe(id);
  });

  it("scans for events regardless of the open switch", async () => {
    const { client } = await signedInAs("sara");
    await addEvent("graduation", { isOpen: false });
    await addStudent("1001");
    await register("1001", "graduation");
    const res = await client
      .post("/api/scans")
      .send({ scans: [scan("1001", "graduation")] });
    expect(res.body.results[0].outcome).toBe("checked_in");
  });

  it("validates the request", async () => {
    const { client } = await signedInAs("sara");
    const good = scan("1001", "graduation");
    const post = (body: unknown) =>
      client.post("/api/scans").send(body as object);

    expect((await post({})).status).toBe(400);
    expect((await post({ scans: [] })).status).toBe(400);
    expect(
      (await post({ scans: [{ ...good, id: "not-a-uuid" }] })).status,
    ).toBe(400);
    expect((await post({ scans: [{ ...good, studentId: "" }] })).status).toBe(
      400,
    );
    expect(
      (await post({ scans: [{ ...good, scannedAt: "yesterday-ish" }] })).status,
    ).toBe(400);
    expect(
      (
        await post({
          scans: Array.from({ length: MAX_SCANS_PER_REQUEST + 1 }, () =>
            scan("1", "graduation"),
          ),
        })
      ).status,
    ).toBe(400);
    const bad = await post({ scans: [{ ...good, eventId: undefined }] });
    expect(bad.body.error).toMatch(/^Invalid request \(scans\.0\.eventId\)/);
  });
});
