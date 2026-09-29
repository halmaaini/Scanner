import { normalizeStudentId } from "@workspace/attendance";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { m } from "@/messages";
import { cardPath } from "./cardPath";

/** Public: a student types their ID to open their card. */
export function LookupPage() {
  const [, navigate] = useLocation();
  const [value, setValue] = useState("");
  const [empty, setEmpty] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const studentId = normalizeStudentId(value);
    setEmpty(!studentId);
    if (studentId) navigate(cardPath(studentId));
  }

  return (
    <Screen className="gap-8 pt-24">
      <header className="flex flex-col gap-3.5">
        <p className="text-sm font-semibold tracking-[0.08em] text-gold-ink uppercase">
          {m.brand.eyebrow}
        </p>
        <h1 className="font-display text-[38px] leading-[1.1] font-semibold">
          {m.lookup.heading}
        </h1>
        <p className="text-base leading-normal text-muted">{m.lookup.intro}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label={m.lookup.studentId}
          scale="lg"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setEmpty(false);
          }}
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        {empty && (
          <p role="alert" className="text-[15px] font-semibold text-bad">
            {m.lookup.empty}
          </p>
        )}
        <Button type="submit" className="w-full">
          {m.lookup.submit}
        </Button>
      </form>

      <footer className="mt-auto">
        <Link href="/login" className={buttonStyles.link}>
          {m.lookup.staffLink}
        </Link>
      </footer>
    </Screen>
  );
}
