import { GraduationCap } from "lucide-react";

/** The navy tile with the gold graduation cap. */
export function Logo() {
  return (
    <div
      className="flex size-14 items-center justify-center rounded-[14px] bg-ink"
      aria-hidden
    >
      <GraduationCap className="size-[30px] text-gold" strokeWidth={2} />
    </div>
  );
}
