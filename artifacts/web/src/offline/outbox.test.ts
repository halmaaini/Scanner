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

  it("dismisses issues without touching waiting changes", () => {
    const outbox = createOutbox(createMemoryStorage(), KEY);
    const a = scanOp("1001");
    outbox.add(a);
    outbox.settle([], [{ op: scanOp("1002"), reason: "revoked", at: "x" }]);
    outbox.dismissIssues();
    expect(outbox.getState()).toEqual({ ops: [a], issues: [] });
  });

  it("clears everything and leaves nothing behind in storage", () => {
    const storage = createMemoryStorage();
    const outbox = createOutbox(storage, KEY);
    outbox.add(scanOp("1001"));
    outbox.clear();
    expect(outbox.getState()).toEqual({ ops: [], issues: [] });
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("ignores damaged saved data instead of crashing", () => {
    const storage = createMemoryStorage();
    storage.setItem(KEY, "{not json");
    expect(createOutbox(storage, KEY).getState().ops).toEqual([]);

    storage.setItem(
      KEY,
      JSON.stringify({
        ops: [{ type: "scan" }, "nope", scanOp("1001")],
        issues: [{ reason: 1 }],
      }),
    );
    const state = createOutbox(storage, KEY).getState();
    expect(state.ops.map((o) => o.studentId)).toEqual(["1001"]);
    expect(state.issues).toEqual([]);
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
