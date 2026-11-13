import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Route-level error UI so one module failure cannot replace the root shell
 * (AppSwitcher + other dashboards stay reachable).
 */
export function ModuleErrorPanel({
  moduleLabel,
  homeTo,
  homeLabel,
  error,
  reset,
}: ErrorComponentProps & {
  moduleLabel: string;
  homeTo: "/";
  homeLabel: string;
}) {
  useEffect(() => {
    reportLovableError(error, { boundary: "module_error_panel", module: moduleLabel });
  }, [error, moduleLabel]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-background px-4 py-10">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {moduleLabel} didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong in this module. Other dashboards in the top bar should still work.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to={homeTo}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
