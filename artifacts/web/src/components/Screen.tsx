import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ScreenProps {
  children: ReactNode;
  /** `md` is a phone-sized column; `wide` gives tables and lists more room. */
  width?: "md" | "wide";
  className?: string;
  /** Take the whole page out of reach (focus and screen readers) while a dialog covers it. */
  inert?: boolean;
}

/** The page frame: a centred column with the prototype's spacing. */
export function Screen({
  children,
  width = "md",
  className,
  inert,
}: ScreenProps) {
  return (
    <main
      inert={inert}
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col gap-5 px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        width === "md" ? "max-w-md" : "max-w-2xl",
        className,
      )}
    >
      {children}
    </main>
  );
}
