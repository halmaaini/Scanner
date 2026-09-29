import { LoaderCircle } from "lucide-react";
import { m } from "@/messages";

/** Shown while the app works out who is signed in. */
export function Splash() {
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center text-muted"
    >
      <LoaderCircle className="size-8 animate-spin" aria-hidden />
      <span className="sr-only">{m.common.loading}</span>
    </div>
  );
}
