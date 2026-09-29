import { useSyncExternalStore } from "react";

/**
 * Whether the server can be reached right now. `navigator.onLine` alone lies
 * (Wi-Fi with no internet says "online"), so the app also records how its own
 * requests fared: any answer from the server means reachable, a network failure
 * means not. This is the one place that answer lives.
 */
let reachable = true;
const listeners = new Set<() => void>();

const browserOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function reportReachable(value: boolean): void {
  if (reachable === value) return;
  reachable = value;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onBrowserChange = () => {
    // Back on a network: assume it works until a request says otherwise.
    if (browserOnline()) reachable = true;
    notify();
  };
  window.addEventListener("online", onBrowserChange);
  window.addEventListener("offline", onBrowserChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("online", onBrowserChange);
    window.removeEventListener("offline", onBrowserChange);
  };
}

const getSnapshot = () => browserOnline() && reachable;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
