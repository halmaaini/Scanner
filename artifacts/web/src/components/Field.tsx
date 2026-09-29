import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Keep the label for screen readers but do not show it. */
  hideLabel?: boolean;
  /** `lg` is the taller field used for the main input on a screen. */
  scale?: "md" | "lg";
}

/** A labelled text input; the label is always tied to the input. */
export function Field({
  label,
  hideLabel = false,
  scale = "md",
  id,
  className,
  ...input
}: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label
        htmlFor={inputId}
        className={hideLabel ? "sr-only" : "text-sm font-semibold"}
      >
        {label}
      </label>
      <input
        {...input}
        id={inputId}
        className={cn(
          "w-full min-w-0 rounded-xl border-[1.5px] border-line bg-white px-4 text-ink placeholder:text-muted/70",
          scale === "lg" ? "h-14 text-lg" : "h-[52px] text-[17px]",
          className,
        )}
      />
    </div>
  );
}
