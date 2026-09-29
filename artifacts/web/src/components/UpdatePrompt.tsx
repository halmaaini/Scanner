import { useRegisterSW } from "virtual:pwa-register/react";
import { UPDATE_CHECK_MS } from "@/config";
import { m } from "@/messages";

/**
 * Offers a new version of the app instead of swapping it in silently: a phone
 * that stays open for days would otherwise keep running the old code, and an
 * unannounced reload could interrupt a scan. Saved check-ins survive a reload
 * (they are kept on the device), so tapping Reload is always safe.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An app that stays open still checks for a new version now and then.
      if (registration) {
        setInterval(() => void registration.update(), UPDATE_CHECK_MS);
      }
    },
  });

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-[15px] text-white shadow-lg"
    >
      <span>{m.common.update.available}</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="inline-flex min-h-11 items-center px-2 font-semibold underline underline-offset-2"
      >
        {m.common.update.reload}
      </button>
    </div>
  );
}
