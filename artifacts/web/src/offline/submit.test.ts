import type { Scan } from "@workspace/api-client-react";
import { describe, expect, it } from "vitest";
import { applyPendingOps } from "@/domain/overlay";
import { makeRoster } from "@/domain/testing";
import { submitScan, submitUndo } from "./submit";
import {
  cleared,
  createTestSync,
  httpError,
  networkError,
  recorded,
} from "./testing";

const NOW = new Date("2026-06-12T10:42:00.000Z");

function setup(api: Parameters<typeof createTestSync>[0] = {}) {
  const sync = createTestSync(api);
  let counter = 0;
  const deps = {
    outbox: sync.outbox,
    engine: sync.engine,
    now: () => NOW,
    newId: () => `id-${++counter}`,
  };
  /** The roster as the scanner sees it: saved copy plus unsent changes. */
  const view = () => applyPendingOps(makeRoster(), sync.outbox.getState().ops);
  const scan = (raw: string, eventId = "graduation") =>
    submitScan(deps, { raw, eventId, staffId: 2, view: view() });
  return { ...sync, deps, scan, view };
}

const offline = {
  submitScans: async () => {
    throw networkError();
  },
};

describe("submitScan", () => {
  it("ignores blank input", async () => {
    const { scan, api } = setup();
    expect(await scan("   ")).toBeNull();
    expect(api.submitScans).not.toHaveBeenCalled();
  });

  it("returns the server's answer and leaves nothing queued", async () => {
    const { scan, outbox } = setup();

    const response = await scan("1002");

    expect(response).toMatchObject({
      kind: "answered",
      result: { outcome: "checked_in", studentId: "1002" },
    });
    expect(outbox.getState().ops).toEqual([]);
  });

  it("sends the scan as it happened, with a clean ID", async () => {
    const { scan, api } = setup();
    await scan(" ١٠٠٢ ");
    const [scans] = (
      api.submitScans as unknown as { mock: { calls: [Scan[]][] } }
    ).mock.calls[0]!;
    expect(scans).toEqual([
      {
        id: "id-1",
        studentId: "1002",
        eventId: "graduation",
        scannedAt: NOW.toISOString(),
      },
    ]);
  });

  it("keeps a scan it could not send, and shows the saved list's verdict as offline", async () => {
    const { scan, outbox } = setup(offline);

    const response = await scan("1002");

    expect(response).toMatchObject({
      kind: "offline",
      result: { outcome: "checked_in", student: { fullName: "Yusuf Ibrahim" } },
    });
    expect(outbox.getState().ops).toMatchObject([
      { type: "scan", studentId: "1002", staffId: 2 },
    ]);
  });

  it("spots a repeat scan made offline on the same device", async () => {
    const { scan, outbox } = setup(offline);

    const first = await scan("1002");
    const second = await scan("1002");

    expect(first).toMatchObject({
      kind: "offline",
      result: { outcome: "checked_in" },
    });
    expect(second).toMatchObject({
      kind: "offline",
      result: { outcome: "already_checked_in" },
    });
    // Only the first is worth keeping.
    expect(outbox.getState().ops).toHaveLength(1);
  });

  it("does not keep offline scans that would be refused anyway", async () => {
    const { scan, outbox } = setup(offline);

    expect(await scan("1003")).toMatchObject({
      kind: "offline",
      result: { outcome: "revoked" },
    });
    expect(await scan("9999")).toMatchObject({
      kind: "offline",
      result: { outcome: "unknown_student" },
    });
    expect(await scan("1001", "rehearsal")).toMatchObject({
      kind: "offline",
      result: { outcome: "already_checked_in" },
    });
    expect(outbox.getState().ops).toEqual([]);
  });

  it("says so when there is no saved list and no connection", async () => {
    const sync = createTestSync(offline);
    const response = await submitScan(
      { outbox: sync.outbox, engine: sync.engine },
      { raw: "1002", eventId: "graduation", staffId: 2, view: undefined },
    );
    expect(response).toEqual({ kind: "unavailable" });
    expect(sync.outbox.getState().ops).toEqual([]);
  });

  it("answers a stray, oversized code as an unknown ID without asking the server", async () => {
    const { scan, api, outbox } = setup();
    const response = await scan("https://example.com/" + "x".repeat(100));
    expect(response).toMatchObject({
      kind: "answered",
      result: { outcome: "unknown_student" },
    });
    expect(api.submitScans).not.toHaveBeenCalled();
    expect(outbox.getState().ops).toEqual([]);
  });

  it("sends earlier offline scans first, in order, when the connection returns", async () => {
    let online = false;
    const sent: string[] = [];
    const { scan, outbox } = setup({
      submitScans: async (scans: Scan[]) => {
        if (!online) throw networkError();
        sent.push(scans.map((s) => s.studentId).join(","));
        return scans.map((s) => recorded(s));
      },
    });
    await scan("1001", "graduation");
    online = true;

    const response = await scan("1002");

    expect(response).toMatchObject({
      kind: "answered",
      result: { outcome: "checked_in" },
    });
    expect(outbox.getState().ops).toEqual([]);
    expect(sent).toEqual(["1001,1002"]);
  });

  it("treats a scan the server cannot read as an unknown ID", async () => {
    const { scan, outbox } = setup({
      submitScans: async () => {
        throw httpError(400);
      },
    });
    expect(await scan("1002")).toMatchObject({
      kind: "answered",
      result: { outcome: "unknown_student" },
    });
    expect(outbox.getState()).toEqual({ ops: [], issues: [] });
  });
});

describe("submitUndo", () => {
  it("takes back a scan that never left this device instead of undoing it", async () => {
    const { deps, scan, outbox, api } = setup({
      ...offline,
      undoCheckIn: async () => {
        throw networkError();
      },
    });
    const response = await scan("1002");
    expect(response).toMatchObject({ kind: "offline" });

    const undone = await submitUndo(deps, {
      studentId: "1002",
      eventId: "graduation",
      staffId: 2,
      scanOpId: (response as { opId: string }).opId,
    });

    // As far as the server will ever know, it never happened.
    expect(undone).toEqual({ kind: "done", registration: null });
    expect(outbox.getState().ops).toEqual([]);
    expect(api.undoCheckIn).not.toHaveBeenCalled();
  });

  it("still sends an undo when the scan it corrects already reached the server", async () => {
    const { deps, scan, outbox, api } = setup();
    const response = await scan("1002");
    expect(response).toMatchObject({ kind: "answered" });

    const undone = await submitUndo(deps, {
      studentId: "1002",
      eventId: "graduation",
      staffId: 2,
      scanOpId: (response as { opId: string }).opId,
    });

    expect(undone).toEqual({ kind: "done", registration: cleared("1002") });
    expect(api.undoCheckIn).toHaveBeenCalledTimes(1);
    expect(outbox.getState().ops).toEqual([]);
  });

  it("undoes through the server when it can", async () => {
    const { deps } = setup();
    expect(
      await submitUndo(deps, {
        studentId: "1002",
        eventId: "graduation",
        staffId: 2,
      }),
    ).toEqual({
      kind: "done",
      registration: cleared("1002"),
    });
  });

  it("queues the undo behind the scan it corrects when offline", async () => {
    const { deps, scan, outbox } = setup({
      ...offline,
      undoCheckIn: async () => {
        throw networkError();
      },
    });
    await scan("1002");

    const response = await submitUndo(deps, {
      studentId: "1002",
      eventId: "graduation",
      staffId: 2,
    });

    expect(response).toEqual({ kind: "queued" });
    expect(outbox.getState().ops.map((op) => op.type)).toEqual([
      "scan",
      "undo",
    ]);
  });

  it("queues the undo behind a scan whose request timed out: the server may have recorded it", async () => {
    const { deps, scan, outbox, api } = setup({
      submitScans: async () => {
        throw new DOMException("Request timed out", "TimeoutError");
      },
      undoCheckIn: async () => {
        throw networkError();
      },
    });
    const response = await scan("1002");
    expect(response).toMatchObject({ kind: "offline" });

    const undone = await submitUndo(deps, {
      studentId: "1002",
      eventId: "graduation",
      staffId: 2,
      scanOpId: (response as { opId: string }).opId,
    });

    // Not taken back as if it never happened: the undo goes in behind the scan.
    expect(undone).toEqual({ kind: "queued" });
    expect(outbox.getState().ops.map((op) => op.type)).toEqual([
      "scan",
      "undo",
    ]);
    // It waits its turn: nothing goes out ahead of the scan that could not be sent.
    expect(api.undoCheckIn).not.toHaveBeenCalled();
  });

  it("reports an undo the server refuses", async () => {
    const { deps } = setup({
      undoCheckIn: async () => {
        throw httpError(403);
      },
    });
    expect(
      await submitUndo(deps, {
        studentId: "1002",
        eventId: "graduation",
        staffId: 2,
      }),
    ).toEqual({
      kind: "refused",
    });
  });
});
