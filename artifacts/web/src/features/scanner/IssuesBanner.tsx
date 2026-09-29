import { TriangleAlert } from "lucide-react";
import { buttonStyles } from "@/components/buttonStyles";
import { indexRoster, type Roster } from "@/domain/roster";
import { m } from "@/messages";
import { outbox } from "@/offline";
import { useOutbox } from "@/offline/hooks";

/**
 * Changes the server refused after they had been saved offline (for example a
 * student revoked in the meantime). They are never dropped silently: the
 * person sees exactly what did not go through until they dismiss it.
 */
export function IssuesBanner({ view }: { view: Roster | undefined }) {
  const { issues } = useOutbox();
  if (issues.length === 0) return null;

  const index = view ? indexRoster(view) : undefined;

  return (
    <section
      aria-labelledby="issues-title"
      className="flex flex-col gap-2 rounded-xl bg-bad-soft p-4"
    >
      <h2
        id="issues-title"
        className="flex items-center gap-2 text-[15px] font-semibold text-bad"
      >
        <TriangleAlert className="size-[18px]" aria-hidden />
        {m.scanner.issues.title(issues.length)}
      </h2>
      <ul className="flex flex-col gap-1 text-sm text-ink">
        {issues.slice(0, 5).map(({ op, reason, at }) => (
          <li key={`${op.id}-${at}`}>
            <span className="font-semibold">
              {index?.studentById.get(op.studentId)?.fullName ?? op.studentId}
            </span>{" "}
            · {index?.eventById.get(op.eventId)?.name ?? op.eventId} ·{" "}
            {op.type === "scan" ? m.scanner.issues.scan : m.scanner.issues.undo}
            : {m.scanner.issues.reasons[reason]}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => outbox.dismissIssues()}
        className={buttonStyles.link}
      >
        {m.common.dismiss}
      </button>
    </section>
  );
}
