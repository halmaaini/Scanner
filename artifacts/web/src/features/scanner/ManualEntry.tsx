import { useState, type FormEvent, type Ref } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { m } from "@/messages";

interface ManualEntryProps {
  onSubmit: (studentId: string) => void;
  disabled?: boolean;
  /** Lets the screen put the cursor back in the field after a result. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Type a student ID instead of scanning. Enter submits, and the result screen
 * hands the cursor back here, so typing IDs one after another needs no mouse.
 */
export function ManualEntry({
  onSubmit,
  disabled = false,
  inputRef,
}: ManualEntryProps) {
  const [value, setValue] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !value.trim()) return;
    onSubmit(value);
    setValue("");
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2.5">
      <div className="min-w-0 flex-1">
        <Field
          ref={inputRef}
          label={m.scanner.studentId}
          hideLabel
          scale="lg"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={m.scanner.studentId}
          // While a scan is being checked the field is read-only, not disabled:
          // a disabled field would lose the cursor for good.
          readOnly={disabled}
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
