import { SYNC_LOCK_NAME } from "@/config";

/**
 * Runs a sending pass only if no other tab or window of the app is sending
 * right now (the browser's Web Locks decide). If one is, it is already doing
 * this work, and what it sends reaches this tab through the shared saved
 * state. Two tabs sending the same queue could apply an old undo on top of a
 * newer check-in. Browsers without Web Locks just run it.
 */
export async function exclusiveAcrossTabs(
  run: () => Promise<void>,
): Promise<void> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return run();
  }
  await navigator.locks.request(
    SYNC_LOCK_NAME,
    { ifAvailable: true },
    async (lock) => {
      if (lock) await run();
    },
  );
}
