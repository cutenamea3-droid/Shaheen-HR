import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  /** Short label for logs (e.g. "sync conflict") — keeps the shell alive if this island throws. */
  label: string;
};

type State = { error: Error | null };

/**
 * Nested boundary so one Admin sub-panel (conflict UI, badge, etc.) cannot take down
 * the whole `/admin` route ModuleErrorPanel.
 */
export class AdminIslandBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, {
      boundary: "admin_island",
      module: `Admin & Attendance (${this.props.label})`,
      componentStack: info.componentStack ?? undefined,
    });
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="font-semibold">This panel didn&apos;t load</p>
          <p className="mt-1 text-destructive/90">
            The rest of Admin & Attendance should still work. Try again or refresh.
          </p>
          <button
            type="button"
            className="btn mt-2"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
