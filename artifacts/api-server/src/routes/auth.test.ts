import { expect, it, vi } from "vitest";
import {
  addStaff,
  createClient,
  describeWithDb,
  signIn,
} from "../testing/helpers";

describeWithDb("auth", () => {
  it("signs in with the right password and starts a session", async () => {
    await addStaff("sara", { displayName: "Sara", role: "admin" });
    const client = createClient();

    const login = await client
      .post("/api/auth/login")
      .send({ username: "sara", password: "pw" });

    expect(login.status).toBe(200);
    expect(login.body).toEqual({
      staff: {
        id: expect.any(Number),
        username: "sara",
        displayName: "Sara",
        role: "admin",
      },
    });
    const cookie = login.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await client.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.staff.username).toBe("sara");
  });

  it("accepts a password with non-ASCII characters hashed by pgcrypto", async () => {
    const password =
      String.fromCodePoint(0x0643, 0x0644, 0x0645, 0x0629) + "-1";
    await addStaff("sara", { password });
    const res = await createClient()
      .post("/api/auth/login")
      .send({ username: "sara", password });
    expect(res.status).toBe(200);
  });

  // The password is compared in the API, never sent to Postgres, so no query
  // parameter, driver error or database log can ever contain it.
  it("never sends a password to the database", async () => {
    await addStaff("sara", { password: "correct horse battery staple" });
    const { pool } = await import("@workspace/db");
    const spy = vi.spyOn(pool, "query");
    try {
      const attempts = [
        ["sara", "correct horse battery staple"],
        ["sara", "wrong horse battery staple"],
        ["nobody", "another secret phrase"],
      ] as const;
      for (const [username, password] of attempts) {
        await createClient()
          .post("/api/auth/login")
          .send({ username, password });
      }

      // The spy does see queries (the users and the sessions), just not the secrets.
      expect(spy.mock.calls.length).toBeGreaterThan(3);
      const sent = JSON.stringify(spy.mock.calls);
      for (const [, password] of attempts) expect(sent).not.toContain(password);
    } finally {
      spy.mockRestore();
    }
  });

  it("ignores username case and surrounding spaces", async () => {
    await addStaff("Sara");
    const res = await createClient()
      .post("/api/auth/login")
      .send({ username: "  sARA ", password: "pw" });
    expect(res.status).toBe(200);
  });

  it("answers wrong password, unknown user and deactivated account identically", async () => {
    await addStaff("sara");
    await addStaff("gone", { isActive: false });

    const responses = await Promise.all([
      createClient()
        .post("/api/auth/login")
        .send({ username: "sara", password: "nope" }),
      createClient()
        .post("/api/auth/login")
        .send({ username: "nobody", password: "pw" }),
      createClient()
        .post("/api/auth/login")
        .send({ username: "gone", password: "pw" }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid username or password" });
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("rejects a malformed login body", async () => {
    const client = createClient();
    expect((await client.post("/api/auth/login").send({})).status).toBe(400);
    expect(
      (
        await client
          .post("/api/auth/login")
          .send({ username: "", password: "x" })
      ).status,
    ).toBe(400);
    expect(
      (
        await client
          .post("/api/auth/login")
          .send({ username: "a", password: "x".repeat(201) })
      ).status,
    ).toBe(400);
  });

  it("needs a session for /auth/me", async () => {
    const res = await createClient().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not signed in" });
  });

  it("ends the session on logout, and logout is safe when signed out", async () => {
    await addStaff("sara");
    const client = createClient();
    await signIn(client, "sara");

    expect((await client.post("/api/auth/logout")).status).toBe(204);
    expect((await client.get("/api/auth/me")).status).toBe(401);
    expect((await client.post("/api/auth/logout")).status).toBe(204);
  });

  it("ends a session the moment the account is deactivated", async () => {
    const id = await addStaff("sara");
    const client = createClient();
    await signIn(client, "sara");
    expect((await client.get("/api/auth/me")).status).toBe(200);

    const { pool } = await import("@workspace/db");
    await pool.query("update staff set is_active = false where id = $1", [id]);

    expect((await client.get("/api/auth/me")).status).toBe(401);
    // ...and it stays ended even if the account is switched back on.
    await pool.query("update staff set is_active = true where id = $1", [id]);
    expect((await client.get("/api/auth/me")).status).toBe(401);
  });

  it("reflects a role change on the very next request", async () => {
    await addStaff("sara", { role: "admin" });
    const client = createClient();
    await signIn(client, "sara");

    const { pool } = await import("@workspace/db");
    await pool.query("update staff set role = 'super' where username = 'sara'");

    expect((await client.get("/api/auth/me")).body.staff.role).toBe("super");
  });

  it("issues a new session id at every sign-in", async () => {
    await addStaff("sara");
    const client = createClient();
    const first = await client
      .post("/api/auth/login")
      .send({ username: "sara", password: "pw" });
    const second = await client
      .post("/api/auth/login")
      .send({ username: "sara", password: "pw" });
    expect(first.headers["set-cookie"]?.[0]).not.toBe(
      second.headers["set-cookie"]?.[0],
    );
  });

  it("limits failed logins per client but never counts successful ones", async () => {
    await addStaff("sara");
    const client = createClient({
      loginRateLimit: { windowMs: 60_000, limit: 3 },
    });

    for (let i = 0; i < 5; i++) {
      expect(
        (
          await client
            .post("/api/auth/login")
            .send({ username: "sara", password: "pw" })
        ).status,
      ).toBe(200);
    }
    for (let i = 0; i < 3; i++) {
      expect(
        (
          await client
            .post("/api/auth/login")
            .send({ username: "sara", password: "bad" })
        ).status,
      ).toBe(401);
    }
    const blocked = await client
      .post("/api/auth/login")
      .send({ username: "sara", password: "bad" });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: "Too many requests. Try again later.",
    });
  });
});
