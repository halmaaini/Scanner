import { Link } from "wouter";
import { buttonStyles } from "@/components/buttonStyles";
import { Screen } from "@/components/Screen";
import { m } from "@/messages";

export function NotFoundPage() {
  return (
    <Screen className="justify-center gap-3">
      <h1 className="font-display text-3xl font-semibold">
        {m.notFound.title}
      </h1>
      <p className="text-muted">{m.notFound.body}</p>
      <Link href="/" className={buttonStyles.link}>
        {m.notFound.home}
      </Link>
    </Screen>
  );
}
