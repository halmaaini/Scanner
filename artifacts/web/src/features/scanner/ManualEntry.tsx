import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { m } from "@/messages";

interface ManualEntryProps {
  onSubmit: (studentId: string) => void;
  disabled?: boolean;
}

/**
 * Type a student ID instead of scanning. Also what a USB barcode scanner
 * needs: it "types" the code and presses Enter.
 */
export function ManualEntry({ onSubmit, disabled = false }: ManualEntryProps) {
  const [value, setValue] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
    setValue("");
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2.5">
      <div className="min-w-0 flex-1">
        <Field
          label={m.scanner.studentId}
          hideLabel
          scale="lg"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={m.scanner.studentId}
          // IDs may contain letters or dashes, so no number-only keypad.
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <Button type="submit" size="compact" disabled={disabled || !value.trim()}>
        {m.scanner.checkIn}
      </Button>
    </form>
  );
}
