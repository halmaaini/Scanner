import { useGetRoster, type Roster } from "@workspace/api-client-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ROSTER_POLL_MS, SYNC_INTERVAL_MS } from "@/config";
import { applyPendingOps } from "@/domain/overlay";
import { outbox, syncEngine } from "./index";
import type { OutboxState } from "./outbox";
import type { SyncStatus } from "./sync";

export function useOutbox(): OutboxState {
  return useSyncExternalStore(outbox.subscribe, outbox.getState);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getStatus);
}

/**
 * The roster as this device sees it: the server's last word (kept fresh while
 * a screen is open and saved for offline) with this device's unsent changes on
 * top. Every screen and every offline judgement reads this, and nothing else.
 */
export function useRosterView() {
  const query = useGetRoster({
    query: {
      // Always re-read when a screen opens or the page comes back to the front
      // (a phone returning from another app); otherwise every ROSTER_POLL_MS.
      staleTime: 0,
      refetchInterval: ROSTER_POLL_MS,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  });
  const { ops } = useOutbox();
  const view: Roster | undefined = useMemo(
    () => (query.data ? applyPendingOps(query.data, ops) : undefined),
    [query.data, ops],
  );
  return { view, query };
}

/**
 * Keeps trying to send this staff member's waiting changes: on a timer, when
 * the connection returns and when the app is brought back to the front.
 */
export function useSyncLoop(staffId: number): void {
  useEffect(() => {
    const trySend = () => {
      const waiting = outbox
        .getState()
        .ops.some((op) => op.staffId === staffId);
      if (waiting) void syncEngine.flush(staffId);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") trySend();
    };

    trySend();
    const timer = setInterval(trySend, SYNC_INTERVAL_MS);
    window.addEventListener("online", trySend);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", trySend);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [staffId]);
}
