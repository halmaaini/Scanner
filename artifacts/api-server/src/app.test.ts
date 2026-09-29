import { describe, expect, it } from "vitest";
import { addStaff, createClient, describeWithDb } from "./testing/helpers";

const login = { username: "sara", password: "pw" };
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** The Expires attribute of the session cookie in a response, as a time. */
function cookieExpiry(setCookie: string | string[] | undefined): number {
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const expires = /Expires=([^;]+)/i.exec(cookie ?? "")?.[1];
  return Date.parse(expires ?? "");
}

describeWithDb("running behind a proxy", () => {
  describe("sessions", () => {
    // Production runs behind Replit's TLS-terminating proxy: the server sees plain
    // HTTP plus X-Forwarded-Proto: https, and only then may set a Secure cookie.
    it("sets a Secure session cookie when the proxy says the request was HTTPS", async () => {
      await addStaff("sara");
      const client = createClient({ secureCookies: true });

      const res = await client
        .post("/api/auth/login")
        .set("X-Forwarded-Proto", "https")
        .send(login);

      expect(res.status).toBe(200);
      const cookie = res.headers["set-cookie"]?.[0] ?? "";
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      // The agent's cookie jar refuses to replay a Secure cookie over http, so
      // send it by hand, as the browser does over HTTPS.
      const me = await client
        .get("/api/auth/me")
        .set("X-Forwarded-Proto", "https")
        .set("Cookie", cookie.split(";")[0]!);
      expect(me.status).toBe(200);
    });

    it("never hands a Secure cookie to a plain-HTTP request", async () => {
      await addStaff("sara");
      const res = await createClient({ secureCookies: true })
        .post("/api/auth/login")
        .send(login);
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("pushes the session's expiry out on every request (sliding)", async () => {
      await addStaff("sara");
      const client = createClient();
      const first = await client.post("/api/auth/login").send(login);
      await sleep(1100); // cookie expiry has a resolution of one second
      const later = await client.get("/api/auth/me");

      expect(cookieExpiry(later.headers["set-cookie"])).toBeGreaterThan(
        cookieExpiry(first.headers["set-cookie"]),
      );
    });
  });

  describe("client address", () => {
    const tightLimit = { windowMs: 60_000, limit: 2 };
    const lookup = (
      client: ReturnType<typeof createClient>,
      forwardedFor: string,
    ) => client.get("/api/cards/1001").set("X-Forwarded-For", forwardedFor);

    it("limits each visitor separately, by the address the proxy saw", async () => {
      const client = createClient({ cardRateLimit: tightLimit });

      expect((await lookup(client, "1.1.1.1")).status).toBe(404);
      expect((await lookup(client, "1.1.1.1")).status).toBe(404);
      expect((await lookup(client, "1.1.1.1")).status).toBe(429);
      // Someone else is unaffected.
      expect((await lookup(client, "2.2.2.2")).status).toBe(404);
    });

    it("ignores addresses a visitor invents ahead of the proxy's", async () => {
      const client = createClient({ cardRateLimit: tightLimit });

      // All three arrive from 3.3.3.3, whatever they claim to be forwarded for.
      await lookup(client, "9.9.9.9, 3.3.3.3");
      await lookup(client, "8.8.8.8, 3.3.3.3");
      expect((await lookup(client, "7.7.7.7, 3.3.3.3")).status).toBe(429);
    });

    it("reads one address further back when told to expect more proxies", async () => {
      const client = createClient({
        cardRateLimit: tightLimit,
        trustProxyHops: 2,
      });

      // The visitor is 4.4.4.4; the last address is the first proxy's, which changes.
      await lookup(client, "4.4.4.4, 5.0.0.1");
      await lookup(client, "4.4.4.4, 5.0.0.2");
      expect((await lookup(client, "4.4.4.4, 5.0.0.3")).status).toBe(429);
    });
  });
});
