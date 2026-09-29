import type { Scan, ScanResult } from "@workspace/api-client-react";
import { MAX_SCANS_PER_REQUEST } from "@workspace/attendance";
import { describe, expect, it, vi } from "vitest";
import {
  cleared,
  createTestSync,
  deferred,
  hangUntilAborted,
  httpError,
  networkError,
  recorded,
  refused,
  scanOp,
  undoOp,
} from "./testing";

const AT = "2026-06-12T12:00:00.000Z";

describe("sync engine", () => {
  describe("flush (background)", () => {
    it("sends waiting scans of the given staff member only", async () => {
      const { outbox, engine, api } = createTestSync();
      const mine = scanOp("1001");
      const theirs = scanOp("1002", "graduation", { staffId: 3 });
      outbox.add(mine);
      outbox.add(theirs);

      await engine.flush(2);

      expect(api.submitScans).toHaveBeenCalledTimes(1);
      expect(outbox.getState().ops).toEqual([theirs]);
    });

    it("does nothing, and asks nobody, when nothing is waiting", async () => {
      const { engine, api, hooks } = createTestSync();
      await engine.flush(2);
      expect(api.submitScans).not.toHaveBeenCalled();
      expect(hooks.onReachable).not.toHaveBeenCalled();
    });

    it("hands confirmed registrations to the roster and reports the server reachable", async () => {
      const { outbox, engine, hooks } = createTestSync();
      outbox.add(scanOp("1001"));

      await engine.flush(2);

      expect(hooks.onRegistrations).toHaveBeenCalledWith([
        expect.objectContaining({ studentId: "1001", checkedInBy: 2 }),
      ]);
      expect(hooks.onReachable).toHaveBeenLastCalledWith(true);
      expect(hooks.onStale).not.toHaveBeenCalled();
    });

    it("waits for the roster to take the rows before it lets go of the scans", async () => {
      const { outbox, engine, hooks } = createTestSync();
      const rosterUpdated = deferred();
      vi.mocked(hooks.onRegistrations).mockReturnValue(rosterUpdated.promise);
      outbox.add(scanOp("1001"));

      const done = engine.flush(2);
      await vi.waitFor(() => expect(hooks.onRegistrations).toHaveBeenCalled());
      // The scan must not be in neither place: still queued until the roster has it.
      expect(outbox.getState().ops).toHaveLength(1);

      rosterUpdated.resolve();
      await done;
      expect(outbox.getState().ops).toEqual([]);
    });

    it("treats a repeat as done: nothing to file, the queue empties", async () => {
      const { outbox, engine } = createTestSync({
        submitScans: async (scans: Scan[]) =>
          scans.map((s) => ({
            ...recorded(s, 3),
            outcome: "already_checked_in" as const,
          })),
      });
      outbox.add(scanOp("1001"));
      await engine.flush(2);
      expect(outbox.getState()).toEqual({ ops: [], issues: [] });
    });

    it("keeps everything queued when there is no connection, then succeeds later", async () => {
      let online = false;
      const { outbox, engine, hooks } = createTestSync({
        submitScans: async (scans: Scan[]) => {
          if (!online) throw networkError();
          return scans.map((s) => recorded(s));
        },
      });
      const scan = scanOp("1001");
      outbox.add(scan);

      await engine.flush(2);
      expect(outbox.getState().ops).toEqual([scan]);
      expect(hooks.onReachable).toHaveBeenLastCalledWith(false);

      online = true;
      await engine.flush(2);
      expect(outbox.getState().ops).toEqual([]);
      expect(hooks.onReachable).toHaveBeenLastCalledWith(true);
    });

    it("treats a proxy's 'API is down' like no connection", async () => {
      const { outbox, engine, hooks } = createTestSync({
        submitScans: async () => {
          throw httpError(503);
        },
      });
      outbox.add(scanOp("1001"));
      await engine.flush(2);
      expect(outbox.getState().ops).toHaveLength(1);
      expect(hooks.onReachable).toHaveBeenLastCalledWith(false);
      expect(engine.getStatus().serverProblem).toBe(false);
    });

    it("keeps changes queued on a server error, says so, and clears it once it works", async () => {
      let broken = true;
      const { outbox, engine, hooks } = createTestSync({
        submitScans: async (scans: Scan[]) => {
          if (broken) throw httpError(500);
          return scans.map((s) => recorded(s));
        },
      });
      outbox.add(scanOp("1001"));

      await engine.flush(2);
      expect(outbox.getState().ops).toHaveLength(1);
      expect(hooks.onReachable).toHaveBeenLastCalledWith(true);
      expect(hooks.onUnauthorized).not.toHaveBeenCalled();
      expect(engine.getStatus().serverProblem).toBe(true);

      broken = false;
      await engine.flush(2);
      expect(engine.getStatus().serverProblem).toBe(false);
    });

    it("stops and reports an ended session without losing anything", async () => {
      const { outbox, engine, hooks } = createTestSync({
        submitScans: async () => {
          throw httpError(401);
        },
      });
      outbox.add(scanOp("1001"));
      await engine.flush(2);
      expect(outbox.getState().ops).toHaveLength(1);
      expect(hooks.onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it("files a scan the server can never read as an issue, instead of retrying forever", async () => {
      const { outbox, engine } = createTestSync({
        submitScans: async () => {
          throw httpError(400);
        },
      });
      const scan = scanOp("1001");
      outbox.add(scan);

      await engine.flush(2);

      expect(outbox.getState().ops).toEqual([]);
      expect(outbox.getState().issues).toEqual([
        { op: scan, reason: "invalid", at: AT },
      ]);
    });

    it("does not let one unreadable scan take the good ones down with it", async () => {
      const { outbox, engine, api, hooks } = createTestSync({
        submitScans: async (scans: Scan[]) => {
          if (scans.some((s) => s.studentId === "BAD")) throw httpError(400);
          return scans.map((s) => recorded(s));
        },
      });
      const first = scanOp("1001");
      const bad = scanOp("BAD");
      const last = scanOp("1004");
      [first, bad, last].forEach((op) => outbox.add(op));

      await engine.flush(2);

      const sizes = vi
        .mocked(api.submitScans)
        .mock.calls.map(([scans]) => scans.length);
      expect(sizes).toEqual([3, 1, 1, 1]);
      expect(outbox.getState().ops).toEqual([]);
      expect(outbox.getState().issues).toEqual([
        { op: bad, reason: "invalid", at: AT },
      ]);
      expect(hooks.onRegistrations).toHaveBeenCalledWith([
        expect.objectContaining({ studentId: "1001" }),
      ]);
      expect(hooks.onRegistrations).toHaveBeenCalledWith([
        expect.objectContaining({ studentId: "1004" }),
      ]);
    });

    it("applies scans and undos in the order they were made", async () => {
      const { outbox, engine, calls } = createTestSync();
      outbox.add(scanOp("1001"));
      outbox.add(scanOp("1002"));
      outbox.add(undoOp("1001"));
      outbox.add(scanOp("1003"));

      await engine.flush(2);

      expect(calls).toEqual(["scans:1001,1002", "undo:1001", "scans:1003"]);
      expect(outbox.getState().ops).toEqual([]);
    });

    it("hands the cleared registration of an undo to the roster", async () => {
      const { outbox, engine, hooks } = createTestSync();
      outbox.add(undoOp("1001"));
      await engine.flush(2);
      expect(hooks.onRegistrations).toHaveBeenCalledWith([cleared("1001")]);
    });

    it("treats undoing a missing registration as done", async () => {
      const { outbox, engine } = createTestSync({
        undoCheckIn: async () => {
          throw httpError(404);
        },
      });
      outbox.add(undoOp("1001"));
      await engine.flush(2);
      expect(outbox.getState()).toEqual({ ops: [], issues: [] });
    });

    it("files a forbidden undo as an issue", async () => {
      const { outbox, engine } = createTestSync({
        undoCheckIn: async () => {
          throw httpError(403);
        },
      });
      const queued = undoOp("1001");
      outbox.add(queued);
      await engine.flush(2);
      expect(outbox.getState().issues).toEqual([
        { op: queued, reason: "undo_forbidden", at: AT },
      ]);
    });

    it("stops at the first change it cannot send and keeps the rest in order", async () => {
      const { outbox, engine } = createTestSync({
        undoCheckIn: async () => {
          throw networkError();
        },
      });
      outbox.add(scanOp("1001"));
      const undo = undoOp("1001");
      const later = scanOp("1002");
      outbox.add(undo);
      outbox.add(later);

      await engine.flush(2);

      expect(outbox.getState().ops).toEqual([undo, later]);
    });

    it("splits a long queue into requests the API accepts", async () => {
      const { outbox, engine, api } = createTestSync();
      for (let i = 0; i < MAX_SCANS_PER_REQUEST + 1; i++) {
        outbox.add(scanOp(String(1000 + i)));
      }

      await engine.flush(2);

      const sizes = vi
        .mocked(api.submitScans)
        .mock.calls.map(([scans]) => scans.length);
      expect(sizes).toEqual([MAX_SCANS_PER_REQUEST, 1]);
      expect(outbox.getState().ops).toEqual([]);
    });

    it("leaves scans the server did not answer in the queue", async () => {
      const { outbox, engine } = createTestSync({
        submitScans: async (scans: Scan[]) =>
          scans.slice(0, 1).map((s) => recorded(s)),
      });
      outbox.add(scanOp("1001"));
      const second = scanOp("1002");
      outbox.add(second);
      await engine.flush(2);
      expect(outbox.getState().ops).toEqual([second]);
    });

    it("never sends two requests at once, and asking again adds no extra one", async () => {
      let running = 0;
      let overlapped = false;
      const { outbox, engine, api } = createTestSync({
        submitScans: async (scans: Scan[]) => {
          running += 1;
          overlapped ||= running > 1;
          await new Promise((r) => setTimeout(r, 10));
          running -= 1;
          return scans.map((s) => recorded(s));
        },
      });
      outbox.add(scanOp("1001"));
      const first = engine.flush(2);
      await vi.waitFor(() => expect(api.submitScans).toHaveBeenCalledTimes(1));
      // Asked again three times while the first is still under way:
      outbox.add(scanOp("1002"));
      const others = [engine.flush(2), engine.flush(2), engine.flush(2)];

      await Promise.all([first, ...others]);

      expect(overlapped).toBe(false);
      expect(outbox.getState().ops).toEqual([]);
      // One request for the first scan, one for everything that came after.
      expect(api.submitScans).toHaveBeenCalledTimes(2);
    });

    it("reports when it is busy", async () => {
      const { outbox, engine } = createTestSync();
      const seen: boolean[] = [];
      engine.subscribe(() => seen.push(engine.getStatus().syncing));
      outbox.add(scanOp("1001"));
      await engine.flush(2);
      expect(seen).toEqual([true, false]);
    });
  });

  describe("send (someone is waiting)", () => {
    it("hands the person the server's answer", async () => {
      const { outbox, engine } = createTestSync();
      const scan = scanOp("1001");
      outbox.add(scan);

      expect(await engine.send(scan)).toMatchObject({
        kind: "scan",
        result: { outcome: "checked_in", studentId: "1001" },
      });
      expect(outbox.getState().ops).toEqual([]);
    });

    it("hands the person a refusal, and files earlier refused scans as issues", async () => {
      const { outbox, engine, hooks } = createTestSync({
        submitScans: async (scans: Scan[]) =>
          scans.map((s) => refused(s, "revoked")),
      });
      const earlier = scanOp("1001");
      const now = scanOp("1002");
      outbox.add(earlier);
      outbox.add(now);

      const answer = await engine.send(now);

      expect(answer).toMatchObject({
        kind: "scan",
        result: { outcome: "revoked" },
      });
      expect(outbox.getState().ops).toEqual([]);
      expect(outbox.getState().issues).toEqual([
        { op: earlier, reason: "revoked", at: AT },
      ]);
      // A refusal can mean the saved roster is old: ask for a fresh one.
      expect(hooks.onStale).toHaveBeenCalledTimes(1);
    });

    it("answers with nothing when the server cannot be reached, leaving the scan queued", async () => {
      const { outbox, engine } = createTestSync({
        submitScans: async () => {
          throw networkError();
        },
      });
      const scan = scanOp("1001");
      outbox.add(scan);
      expect(await engine.send(scan)).toBeUndefined();
      expect(outbox.getState().ops).toEqual([scan]);
    });

    it("tells the person an unreadable scan was rejected, without filing an issue", async () => {
      const { outbox, engine } = createTestSync({
        submitScans: async () => {
          throw httpError(400);
        },
      });
      const scan = scanOp("1001");
      outbox.add(scan);
      expect(await engine.send(scan)).toEqual({
        kind: "rejected",
        reason: "invalid",
      });
      expect(outbox.getState()).toEqual({ ops: [], issues: [] });
    });

    it("answers an undo, and tells the person when it is forbidden", async () => {
      const ok = createTestSync();
      const undo = undoOp("1001");
      ok.outbox.add(undo);
      expect(await ok.engine.send(undo)).toEqual({
        kind: "undo",
        registration: cleared("1001"),
      });

      const forbidden = createTestSync({
        undoCheckIn: async () => {
          throw httpError(403);
        },
      });
      const refusedUndo = undoOp("1002");
      forbidden.outbox.add(refusedUndo);
      expect(await forbidden.engine.send(refusedUndo)).toEqual({
        kind: "rejected",
        reason: "undo_forbidden",
      });
      expect(forbidden.outbox.getState().issues).toEqual([]);
    });

    it("undoing a registration that is gone counts as done", async () => {
      const { outbox, engine } = createTestSync({
        undoCheckIn: async () => {
          throw httpError(404);
        },
      });
      const undo = undoOp("1001");
      outbox.add(undo);
      expect(await engine.send(undo)).toEqual({
        kind: "undo",
        registration: null,
      });
    });

    // The answer belongs to the change, not to whichever send happens to carry it.
    it("calls off background work that is still on the wire, and answers the person", async () => {
      let call = 0;
      const { outbox, engine, api } = createTestSync({
        submitScans: async (scans: Scan[], signal: AbortSignal) => {
          call += 1;
          if (call === 1) return hangUntilAborted<ScanResult[]>(signal);
          return scans.map((s) => recorded(s));
        },
      });
      const backlog = scanOp("1001");
      outbox.add(backlog);
      const background = engine.flush(2);
      await vi.waitFor(() => expect(api.submitScans).toHaveBeenCalledTimes(1));

      const scan = scanOp("1002");
      outbox.add(scan);
      const answer = await engine.send(scan);

      // Not "offline", and not filed as an issue: the person gets the real answer.
      expect(answer).toMatchObject({
        kind: "scan",
        result: { studentId: "1002", outcome: "checked_in" },
      });
      // The backlog went out again in the same request, once, in order.
      expect(
        vi.mocked(api.submitScans).mock.calls[1]![0].map((s) => s.studentId),
      ).toEqual(["1001", "1002"]);
      expect(outbox.getState()).toEqual({ ops: [], issues: [] });
      await background;
    });

    it("answers the person even when a later background send is what carries the scan", async () => {
      const gate = deferred<ScanResult[]>();
      let call = 0;
      const { outbox, engine, api } = createTestSync({
        submitScans: async (scans: Scan[]) => {
          call += 1;
          if (call === 1) return gate.promise;
          return scans.map((s) => recorded(s));
        },
      });
      outbox.add(scanOp("1001"));
      const first = engine.flush(2);
      await vi.waitFor(() => expect(api.submitScans).toHaveBeenCalledTimes(1));
      // More background flushes queue up behind the first...
      const queued = [engine.flush(2), engine.flush(2)];

      // ...and a scan arrives meanwhile.
      const scan = scanOp("1002");
      outbox.add(scan);
      const answered = engine.send(scan);
      gate.resolve([]);

      expect(await answered).toMatchObject({
        kind: "scan",
        result: { studentId: "1002", outcome: "checked_in" },
      });
      await Promise.all([first, ...queued]);
      expect(outbox.getState()).toEqual({ ops: [], issues: [] });
    });

    it("does not wait for the network while the server is known to be out of reach", async () => {
      const { outbox, engine } = createTestSync(
        {
          submitScans: async (scans: Scan[]) =>
            scans.map((s) => refused(s, "revoked")),
        },
        { isReachable: () => false },
      );
      const scan = scanOp("1001");
      outbox.add(scan);

      // Answered at once with nothing, though a request is being made...
      expect(await engine.send(scan)).toBeUndefined();

      // ...which keeps going in the background; nobody is waiting on its
      // refusal any more, so it is filed for later.
      await vi.waitFor(() => expect(outbox.getState().ops).toEqual([]));
      expect(outbox.getState().issues).toEqual([
        { op: scan, reason: "revoked", at: AT },
      ]);
    });

    it("gives the person no answer when another tab is already sending", async () => {
      const { outbox, engine, api } = createTestSync(
        {},
        { exclusive: async () => {} },
      );
      const scan = scanOp("1001");
      outbox.add(scan);
      expect(await engine.send(scan)).toBeUndefined();
      expect(api.submitScans).not.toHaveBeenCalled();
      expect(outbox.getState().ops).toEqual([scan]);
    });
  });

  describe("cancel", () => {
    it("takes back a change that has not been sent", () => {
      const { outbox, engine } = createTestSync();
      const scan = scanOp("1001");
      outbox.add(scan);
      expect(engine.cancel(scan.id)).toBe(true);
      expect(outbox.getState().ops).toEqual([]);
    });

    it("does nothing for a change that is not waiting", () => {
      const { engine } = createTestSync();
      expect(engine.cancel("nothing-like-it")).toBe(false);
    });

    it("cannot take back a change that is on the wire", async () => {
      const gate = deferred<ScanResult[]>();
      const { outbox, engine, api } = createTestSync({
        submitScans: () => gate.promise,
      });
      const scan = scanOp("1001");
      outbox.add(scan);
      const sending = engine.flush(2);
      await vi.waitFor(() => expect(api.submitScans).toHaveBeenCalled());

      expect(engine.cancel(scan.id)).toBe(false);
      expect(outbox.getState().ops).toEqual([scan]);

      gate.resolve([recorded(scan)]);
      await sending;
      expect(outbox.getState().ops).toEqual([]);
    });
  });
});
