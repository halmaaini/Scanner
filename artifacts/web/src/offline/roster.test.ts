import { getGetRosterQueryKey } from "@workspace/api-client-react";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { makeRoster, reg } from "@/domain/testing";
import { deferred } from "./testing";
import { foldIntoRoster } from "./roster";

const key = getGetRosterQueryKey();
const CHECKED_IN = reg("1002", "graduation", "2026-06-12T10:00:00.000Z", 2);

describe("foldIntoRoster", () => {
  it("puts the confirmed rows into the saved roster", async () => {
    const client = new QueryClient();
    client.setQueryData(key, makeRoster());

    await foldIntoRoster(client, [CHECKED_IN]);

    expect(client.getQueryData<ReturnType<typeof makeRoster>>(key)).toEqual(
      makeRoster({
        registrations: makeRoster().registrations.map((r) =>
          r.studentId === "1002" && r.eventId === "graduation" ? CHECKED_IN : r,
        ),
      }),
    );
  });

  it("leaves a roster read that is under way alone when there is nothing to fold in", async () => {
    const client = new QueryClient();
    const read = deferred<ReturnType<typeof makeRoster>>();
    const queryFn = vi.fn(() => read.promise);
    new QueryObserver(client, { queryKey: key, queryFn }).subscribe(() => {});
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    await foldIntoRoster(client, []);
    read.resolve(makeRoster());

    await vi.waitFor(() =>
      expect(client.getQueryData(key)).toEqual(makeRoster()),
    );
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("calls off an older read that would put the old rows back, and reads again", async () => {
    const client = new QueryClient();
    client.setQueryData(key, makeRoster());
    const older = deferred<ReturnType<typeof makeRoster>>();
    const fresh = makeRoster({
      registrations: [CHECKED_IN],
    });
    const queryFn = vi
      .fn<() => Promise<ReturnType<typeof makeRoster>>>()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValue(fresh);
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn,
      staleTime: 0,
    });
    observer.subscribe(() => {});
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    await foldIntoRoster(client, [CHECKED_IN]);
    // The older read finishing now must not undo anything.
    older.resolve(makeRoster());

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(client.getQueryData(key)).toEqual(fresh));
  });

  it("does not leave a first load that had to be called off waiting for the next poll", async () => {
    const client = new QueryClient();
    const first = deferred<ReturnType<typeof makeRoster>>();
    const queryFn = vi
      .fn<() => Promise<ReturnType<typeof makeRoster>>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(makeRoster());
    new QueryObserver(client, { queryKey: key, queryFn }).subscribe(() => {});
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    await foldIntoRoster(client, [CHECKED_IN]);

    await vi.waitFor(() =>
      expect(client.getQueryData(key)).toEqual(makeRoster()),
    );
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
