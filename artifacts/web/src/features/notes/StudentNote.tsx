import { setStudentNote } from "@workspace/api-client-react";
import { MAX_NOTE_LENGTH } from "@workspace/attendance";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { isNetworkError } from "@/lib/errors";
import { patchRoster } from "@/lib/rosterCache";
import { m } from "@/messages";

interface StudentNoteProps {
  studentId: string;
  note: string | null | undefined;
}

/**
 * A student's one note: shown prominently when there is one, with a way to
 * add, change or remove it. Saving needs a connection (it is not queued like
 * a scan) and never blocks anything.
 */
export function StudentNote({ studentId, note }: StudentNoteProps) {
  const fieldId = useId();
  const [shown, setShown] = useState(note ?? null);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A newer roster (another phone changed it) replaces what is shown.
  useEffect(() => setShown(note ?? null), [note]);

  async function save(next: string) {
    setSaving(true);
    setError(null);
    try {
      const student = await setStudentNote(encodeURIComponent(studentId), {
        note: next,
      });
      setShown(student.note ?? null);
      setDraft(null);
      await patchRoster((roster) => ({
        ...roster,
        students: roster.students.map((s) =>
          s.studentId === student.studentId ? student : s,
        ),
      }));
    } catch (failure) {
      setError(
        isNetworkError(failure) ? m.note.needsConnection : m.note.failed,
      );
    } finally {
      setSaving(false);
    }
  }

  if (draft !== null) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-semibold">
          {m.note.label}
        </label>
        <textarea
          id={fieldId}
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder={m.note.placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-xl border-[1.5px] border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted"
        />
        {error && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="compact" busy={saving} onClick={() => void save(draft)}>
            {m.note.save}
          </Button>
          <Button
            variant="outline"
            size="compact"
            disabled={saving}
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
          >
            {m.note.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {shown && (
        <p
          role="note"
          className="w-full rounded-xl border-2 border-warn bg-warn-soft px-3 py-2 text-base font-semibold whitespace-pre-line text-ink"
        >
          <bdi>{shown}</bdi>
        </p>
      )}
      <div className="flex gap-4">
        <button
          type="button"
          className={buttonStyles.link}
          onClick={() => setDraft(shown ?? "")}
        >
          {shown ? m.note.edit : m.note.add}
        </button>
        {shown && (
          <button
            type="button"
            disabled={saving}
            className={buttonStyles.link}
            onClick={() => void save("")}
          >
            {m.note.clear}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
