import { buttonStyles } from "@/components/buttonStyles";
import type { Student } from "@/domain/roster";
import { m } from "@/messages";

interface StudentChoicesProps {
  candidates: readonly Student[];
  /** How many matched in all (candidates may be cut short). */
  total: number;
  onPick: (studentId: string) => void;
  onCancel: () => void;
}

/** What an ID typed in part matches: the person taps the right student; nothing is guessed. */
export function StudentChoices({
  candidates,
  total,
  onPick,
  onCancel,
}: StudentChoicesProps) {
  return (
    <section
      aria-label={m.scanner.choose.title}
      className="flex flex-col gap-2 rounded-2xl bg-surface p-4"
    >
      <h2 className="text-[15px] font-semibold text-muted">
        {m.scanner.choose.title}
      </h2>
      <ul className="flex flex-col">
        {candidates.map((student) => (
          <li
            key={student.studentId}
            className="border-b border-rule last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onPick(student.studentId)}
              className="flex min-h-14 w-full flex-col items-start justify-center py-2 text-start"
            >
              <span className="font-semibold">
                <bdi>{student.fullName}</bdi>
              </span>
              <span className="text-sm text-muted">
                {student.studentId}
                {student.major && (
                  <>
                    {" · "}
                    <bdi>{student.major}</bdi>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {total > candidates.length && (
        <p className="text-sm text-muted">
          {m.scanner.choose.more(total - candidates.length)}
        </p>
      )}
      <button type="button" onClick={onCancel} className={buttonStyles.link}>
        {m.scanner.choose.cancel}
      </button>
    </section>
  );
}
