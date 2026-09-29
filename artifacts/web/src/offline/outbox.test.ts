import { describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/storage";
import { createOutbox } from "./outbox";
import { scanOp, undoOp } from "./testing";

const KEY = "test.outbox";

describe("outbox", () => {
  it("starts empty", () => {
    expect(createOutbox(createMemoryStorage(), KEY).getState()).toEqual({
      ops: [],
      issues: [],
    });
  });

  it("keeps changes in order and survives a reload", () => {
    const storage = createMemoryStorage();
    const first = scanOp("1001");
    const second = undoOp("1001");
    const outbox = createOutbox(storage, KEY);
    outbox.add(first);
    outbox.add(second);

    const reloaded = createOutbox(storage, KEY);
    expect(reloaded.getState().ops).toEqual([first, second]);
  });

  it("settling removes answered changes and files the issues, in one step", () => {
    const outbox = createOutbox(createMemoryStorage(), KEY);
    const a = scanOp("1001");
    const b = scanOp("1002");
    const c = scanOp("1003");
    [a, b, c].forEach((op) => outbox.add(op));
    const issue = {
      op: b,
      reason: "revoked" as const,
      at: "2026-06-12T12:00:00.000Z",
    };

    outbox.settle([a.id, b.id], [issue]);

    expect(outbox.getState().ops).toEqual([c]);
    expect(outbox.getState().issues).toEqual([issue]);
  });

  it("dismisses one person's issues without touching waiting changes or anyone else's", () => {
    const outbox = createOutbox(createMemoryStorage(), KEY);
    const a = scanOp("1001");
    outbox.add(a);
    const mine = { op: scanOp("1002"), reason: "revoked" as const, at: "x" };
    const theirs = {
      op: scanOp("1003", "graduation", { staffId: 3 }),
      reason: "revoked" as const,
      at: "y",
    };
    outbox.settle([], [mine, theirs]);

    outbox.dismissIssues(2);

    expect(outbox.getState()).toEqual({ ops: [a], issues: [theirs] });
  });

  it("leaves nothing behind in storage once everything is settled", () => {
    const storage = createMemoryStorage();
    const outbox = createOutbox(storage, KEY);
    const op = scanOp("1001");
    outbox.add(op);
    expect(storage.getItem(KEY)).not.toBeNull();
    outbox.settle([op.id]);
    expect(outbox.getState()).toEqual({ ops: [], issues: [] });
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("ignores damaged saved data instead of crashing, but keeps a copy", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = createMemoryStorage();
    storage.setItem(KEY, "{not json");
    expect(createOutbox(storage, KEY).getState().ops).toEqual([]);
    expect(storage.getItem(`${KEY}.unreadable`)).toBe("{not json");
    warn.mockRestore();
  });

  it("drops entries it cannot understand, keeping a copy of what was saved", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = createMemoryStorage();
    const raw = JSON.stringify({
      version: 1,
      ops: [{ type: "scan" }, "nope", scanOp("1001")],
      issues: [{ reason: 1 }],
    });
    storage.setItem(KEY, raw);

    const state = createOutbox(storage, KEY).getState();

    expect(state.ops.map((o) => o.studentId)).toEqual(["1001"]);
    expect(state.issues).toEqual([]);
    expect(storage.getItem(`${KEY}.unreadable`)).toBe(raw);
    warn.mockRestore();
  });

  it("does not throw away changes saved in a format it does not know", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = createMemoryStorage();
    const raw = JSON.stringify({ version: 99, ops: [scanOp("1001")] });
    storage.setItem(KEY, raw);

    const outbox = createOutbox(storage, KEY);
    outbox.add(scanOp("1002")); // writes over the main entry...

    expect(storage.getItem(`${KEY}.unreadable`)).toBe(raw); // ...but the old data is kept
    warn.mockRestore();
  });

  it("writes the format version with the data", () => {
    const storage = createMemoryStorage();
    createOutbox(storage, KEY).add(scanOp("1001"));
    expect(JSON.parse(storage.getItem(KEY)!)).toMatchObject({ version: 1 });
  });

  it("picks up what another tab wrote when asked to refresh, and only then tells anyone", () => {
    const storage = createMemoryStorage();
    const tabA = createOutbox(storage, KEY);
    const tabB = createOutbox(storage, KEY);
    const listener = vi.fn();
    tabA.subscribe(listener);

    tabA.refresh();
    expect(listener).not.toHaveBeenCalled(); // nothing changed

    tabB.add(scanOp("1001"));
    expect(tabA.getState().ops).toEqual([]);
    tabA.refresh();
    expect(tabA.getState().ops.map((o) => o.studentId)).toEqual(["1001"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells subscribers about changes and hands out the same state until one happens", () => {
    const outbox = createOutbox(createMemoryStorage(), KEY);
    const listener = vi.fn();
    const stop = outbox.subscribe(listener);

    const before = outbox.getState();
    expect(outbox.getState()).toBe(before);

    outbox.add(scanOp("1001"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(outbox.getState()).not.toBe(before);

    stop();
    outbox.add(scanOp("1002"));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not lose a change another tab wrote in the meantime", () => {
    const storage = createMemoryStorage();
    const tabA = createOutbox(storage, KEY);
    const tabB = createOutbox(storage, KEY);
    tabA.add(scanOp("1001"));
    tabB.add(scanOp("1002"));

    expect(
      createOutbox(storage, KEY)
        .getState()
        .ops.map((o) => o.studentId),
    ).toEqual(["1001", "1002"]);
  });
});
