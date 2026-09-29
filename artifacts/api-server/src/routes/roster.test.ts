import { expect, it } from "vitest";
import {
  addEvent,
  addStaff,
  addStudent,
  createClient,
  describeWithDb,
  register,
  signIn,
} from "../testing/helpers";

describeWithDb("roster", () => {
  it("is for signed-in staff only", async () => {
    const res = await createClient().get("/api/roster");
    expect(res.status).toBe(401);
  });

  it("returns events, students, registrations and staff in a stable order", async () => {
    const sara = await addStaff("sara", { displayName: "Sara" });
    const omar = await addStaff("omar", {
      displayName: "Omar",
      isActive: false,
    });
    await addEvent("graduation", {
      name: "Graduation",
      sortOrder: 2,
      isOpen: true,
    });
    await addEvent("rehearsal", {
      name: "Rehearsal",
      sortOrder: 1,
      isOpen: false,
    });
    await addStudent("1002", "Yusuf Ibrahim");
    await addStudent("1001", "Layla Hassan");
    await addStudent("1003", "Karim Nasser", false);
    await register("1002", "graduation");
    await register("1001", "rehearsal", {
      by: omar,
      at: "2026-06-11T09:14:00.000Z",
    });
    await register("1001", "graduation");

    const client = createClient();
    await signIn(client, "sara");
    const res = await client.get("/api/roster");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({
      events: [
        { id: "rehearsal", name: "Rehearsal", sortOrder: 1, isOpen: false },
        { id: "graduation", name: "Graduation", sortOrder: 2, isOpen: true },
      ],
      students: [
        { studentId: "1001", fullName: "Layla Hassan", isActive: true },
        { studentId: "1002", fullName: "Yusuf Ibrahim", isActive: true },
        { studentId: "1003", fullName: "Karim Nasser", isActive: false },
      ],
      registrations: [
        {
          studentId: "1001",
          eventId: "graduation",
          checkedInAt: null,
          checkedInBy: null,
        },
        {
          studentId: "1002",
          eventId: "graduation",
          checkedInAt: null,
          checkedInBy: null,
        },
        {
          studentId: "1001",
          eventId: "rehearsal",
          checkedInAt: "2026-06-11T09:14:00.000Z",
          checkedInBy: omar,
        },
      ],
      // Deactivated staff stay listed so old check-ins still show who did them.
      staff: [
        { id: sara, displayName: "Sara" },
        { id: omar, displayName: "Omar" },
      ],
    });
  });

  it("returns empty lists for a new, empty system", async () => {
    await addStaff("sara");
    const client = createClient();
    await signIn(client, "sara");
    const res = await client.get("/api/roster");
    expect(res.body).toMatchObject({
      events: [],
      students: [],
      registrations: [],
    });
  });
});
