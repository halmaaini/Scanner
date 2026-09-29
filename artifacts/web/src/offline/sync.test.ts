import type { Scan } from "@workspace/api-client-react";
import { MAX_SCANS_PER_REQUEST } from "@workspace/attendance";
import { describe, expect, it, vi } from "vitest";
import {
  cleared,
  createTestSync,
  httpError,
  networkError,
  recorded,
  refused,
  scanOp,
  undoOp,
} from "./testing";

describe("sync engine", () => {
  it("sends waiting scans of the given staff member only", async () => {
    const { outbox, engine, api } = createTestSync();
    const mine = scanOp("1001");
    const theirs = scanOp("1002", "graduation", { staffId: 3 });
    outbox.add(mine);
    outbox.add(theirs);

    const answers = await engine.flush(2);

    expect(api.submitScans).toHaveBeenCalledTimes(1);
    expect([...answers.keys()]).toEqual([mine.id]);
    expect(outbox.getState().ops).toEqual([theirs]);
  });

  it("does nothing, and asks nobody, when nothing is waiting", async () => {
    const { engine, api, hooks } = createTestSync();
    expect((await engine.flush(2)).size).toBe(0);
    expect(api.submitScans).not.toHaveBeenCalled();
    expect(hooks.onReachable).not.toHaveBeenCalled();
  });

  it("hands confirmed registrations to the roster and reports the server reachable", async () => {
    const { outbox, engine, hooks } = createTestSync();
    const scan = scanOp("1001");
    outbox.add(scan);

    const answers = await engine.flush(2);

    expect(answers.get(scan.id)).toMatchObject({
      kind: "scan",
      result: { outcome: "checked_in" },
    });
    expect(hooks.onRegistrations).toHaveBeenCalledWith([
      expect.objectContaining({ studentId: "1001", checkedInBy: 2 }),
    ]);
    expect(hooks.onReachable).toHaveBeenLastCalledWith(true);
    expect(hooks.onStale).not.toHaveBeenCalled();
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

  it("files refused scans as issues, except the one someone is waiting on", async () => {
    const { outbox, engine, hooks } = createTestSync({
      submitScans: async (scans: Scan[]) =>
        scans.map((s) => refused(s, "revoked")),
    });
    const earlier = scanOp("1001");
    const now = scanOp("1002");
    outbox.add(earlier);
    outbox.add(now);

    const answers = await engine.flush(2, now.id);

    expect(answers.get(now.id)).toMatchObject({
      kind: "scan",
      result: { outcome: "revoked" },
    });
    expect(outbox.getState().ops).toEqual([]);
    expect(outbox.getState().issues).toEqual([
      { op: earlier, reason: "revoked", at: "2026-06-12T12:00:00.000Z" },
    ]);
    // A refusal can mean the saved roster is old: ask for a fresh one.
    expect(hooks.onStale).toHaveBeenCalledTimes(1);
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

    expect((await engine.flush(2)).size).toBe(0);
    expect(outbox.getState().ops).toEqual([scan]);
    expect(hooks.onReachable).toHaveBeenLastCalledWith(false);

    online = true;
    expect((await engine.flush(2)).size).toBe(1);
    expect(outbox.getState().ops).toEqual([]);
    expect(hooks.onReachable).toHaveBeenLastCalledWith(true);
  });

  it("keeps changes queued on a server error, and knows the server is reachable", async () => {
    const { outbox, engine, hooks } = createTestSync({
      submitScans: async () => {
        throw httpError(503);
      },
    });
    outbox.add(scanOp("1001"));
    await engine.flush(2);
    expect(outbox.getState().ops).toHaveLength(1);
    expect(hooks.onReachable).toHaveBeenLastCalledWith(true);
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
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

  it("gives up on scans the server can never read, instead of retrying forever", async () => {
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
      { op: scan, reason: "invalid", at: "2026-06-12T12:00:00.000Z" },
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

  it("answers an undo with the cleared registration", async () => {
    const { outbox, engine, hooks } = createTestSync();
    const undo = undoOp("1001");
    outbox.add(undo);
    const answers = await engine.flush(2);
    expect(answers.get(undo.id)).toEqual({
      kind: "undo",
      registration: cleared("1001"),
    });
    expect(hooks.onRegistrations).toHaveBeenCalledWith([cleared("1001")]);
  });

  it("treats undoing a missing registration as done", async () => {
    const { outbox, engine } = createTestSync({
      undoCheckIn: async () => {
        throw httpError(404);
      },
    });
    const undo = undoOp("1001");
    outbox.add(undo);
    const answers = await engine.flush(2);
    expect(answers.get(undo.id)).toEqual({ kind: "undo", registration: null });
    expect(outbox.getState()).toEqual({ ops: [], issues: [] });
  });

  it("reports a forbidden undo, filing it only when nobody is waiting", async () => {
    const forbidden = {
      undoCheckIn: async () => {
        throw httpError(403);
      },
    };

    const background = createTestSync(forbidden);
    const queued = undoOp("1001");
    background.outbox.add(queued);
    await background.engine.flush(2);
    expect(background.outbox.getState().issues).toEqual([
      { op: queued, reason: "undo_forbidden", at: "2026-06-12T12:00:00.000Z" },
    ]);

    const interactive = createTestSync(forbidden);
    const waited = undoOp("1002");
    interactive.outbox.add(waited);
    const answers = await interactive.engine.flush(2, waited.id);
    expect(answers.get(waited.id)).toEqual({
      kind: "rejected",
      reason: "undo_forbidden",
    });
    expect(interactive.outbox.getState().issues).toEqual([]);
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
    const first = scanOp("1001");
    const second = scanOp("1002");
    outbox.add(first);
    outbox.add(second);
    await engine.flush(2);
    expect(outbox.getState().ops).toEqual([second]);
  });

  it("never sends two batches at once, even if flushed twice", async () => {
    let running = 0;
    let overlapped = false;
    const { outbox, engine } = createTestSync({
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
    outbox.add(scanOp("1002"));
    const second = engine.flush(2);

    await Promise.all([first, second]);

    expect(overlapped).toBe(false);
    expect(outbox.getState().ops).toEqual([]);
  });

  it("reports when it is busy", async () => {
    const { outbox, engine } = createTestSync();
    const seen: boolean[] = [];
    engine.subscribe(() => seen.push(engine.getStatus().syncing));
    outbox.add(scanOp("1001"));
    await engine.flush(2);
    expect(seen).toEqual([true, false]);
    expect(engine.getStatus().syncing).toBe(false);
  });
});
