import { Component, type ErrorInfo, type ReactNode } from "react";
import { m } from "@/messages";

interface State {
  failed: boolean;
}

/**
 * Last line of defence: an unexpected error in a screen shows a plain message
 * with a reload button instead of a blank page (the person at the door has
 * nothing else to fall back on).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Screen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
        <h1 className="font-display text-3xl font-semibold">
          {m.common.crashed.title}
        </h1>
        <p className="text-muted">{m.common.crashed.body}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-14 rounded-[14px] bg-ink px-6 text-[17px] font-semibold text-white"
        >
          {m.common.crashed.reload}
        </button>
      </main>
    );
  }
}
