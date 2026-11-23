import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Dispatch Operations is no longer part of this Compliance + Attendance app.
 * Soft landing for old bookmarks — no portal module import / no Dispatch probes.
 */
function DispatchRemoved() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dispatch is not in this app
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This deploy serves Driver Compliance and Admin &amp; Attendance only. Dispatch
          cloud tables were not deleted.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go to Driver Compliance
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch not available — Shaheen Transport" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DispatchRemoved,
});
