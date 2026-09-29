import {
  getGetCurrentStaffQueryKey,
  useLogin,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Button } from "@/components/Button";
import { buttonStyles } from "@/components/buttonStyles";
import { Field } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { statusOf } from "@/lib/errors";
import { m } from "@/messages";
import { useStaff } from "./useStaff";

/** Anything other than a clear "no" or "slow down" is treated as the server being out of reach. */
function messageFor(error: unknown): string {
  if (statusOf(error) === 401) return m.login.wrongCredentials;
  if (statusOf(error) === 429) return m.login.tooManyAttempts;
  return m.login.unreachable;
}

export function LoginPage() {
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);

  const login = useLogin({
    mutation: {
      onSuccess: (session) => {
        queryClient.setQueryData(getGetCurrentStaffQueryKey(), session);
        navigate("/scan", { replace: true });
      },
      onError: (err) => setError(messageFor(err)),
    },
  });

  if (staff.status === "signedIn") return <Redirect to="/scan" replace />;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    login.mutate({
      data: {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      },
    });
  }

  return (
    <Screen className="gap-10 pt-16">
      <header className="flex flex-col gap-4">
        <Logo />
        <h1 className="font-display text-[38px] leading-[1.1] font-semibold">
          {m.login.heading[0]}
          <br />
          {m.login.heading[1]}
        </h1>
        <p className="text-base leading-normal text-muted">{m.login.intro}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label={m.login.username}
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <Field
          label={m.login.password}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p role="alert" className="text-[15px] font-semibold text-bad">
            {error}
          </p>
        )}
        <Button type="submit" busy={login.isPending} className="w-full">
          {login.isPending ? m.login.submitting : m.login.submit}
        </Button>
      </form>

      <footer className="mt-auto flex flex-col gap-3">
        <p className="text-sm leading-normal text-muted">
          {m.login.accountsNote}
        </p>
        <Link href="/card" className={buttonStyles.link}>
          {m.login.studentLink}
        </Link>
      </footer>
    </Screen>
  );
}
