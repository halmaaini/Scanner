import { Check, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useOnline } from "@/lib/network";
import { m } from "@/messages";
import { syncEngine } from "@/offline";
import { useOutbox, useSyncStatus } from "@/offline/hooks";
import { useCurrentStaff } from "@/features/auth/StaffContext";

/** Connection and sync state in one line, as in the prototype's footer. */
export function SyncStatus() {
  const staff = useCurrentStaff();
  const online = useOnline();
  const { ops } = useOutbox();
  const { syncing, serverProblem } = useSyncStatus();
  // Changes are only ever sent by the person who made them.
  const waiting = ops.filter((op) => op.staffId === staff.id).length;
  const othersWaiting = ops.length - waiting;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="status"
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm",
          online ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
        )}
      >
        {online ? (
          <Check
            className="size-[18px] shrink-0"
            strokeWidth={2.2}
            aria-hidden
          />
        ) : (
          <WifiOff
            className="size-[18px] shrink-0"
            strokeWidth={2.2}
            aria-hidden
          />
        )}
        <span className="font-semibold">
          {online ? m.scanner.sync.online : m.scanner.sync.offline}
        </span>
        <span>
          {syncing
            ? m.scanner.sync.syncing
            : waiting === 0
              ? m.scanner.sync.allSynced
              : m.scanner.sync.waiting(waiting)}
        </span>
        {online && waiting > 0 && !syncing && (
          <button
            type="button"
            onClick={() => void syncEngine.flush(staff.id)}
            className="ms-auto inline-flex min-h-11 items-center px-2 font-semibold underline underline-offset-2"
          >
            {m.scanner.sync.syncNow}
          </button>
        )}
      </div>
      {serverProblem && (
        <p
          role="status"
          className="rounded-xl bg-warn-soft px-3.5 py-3 text-sm text-warn"
        >
          {m.scanner.sync.serverProblem}
        </p>
      )}
      {othersWaiting > 0 && (
        <p
          role="status"
          className="rounded-xl bg-warn-soft px-3.5 py-3 text-sm text-warn"
        >
          {m.scanner.sync.othersWaiting(othersWaiting)}
        </p>
      )}
    </div>
  );
}
