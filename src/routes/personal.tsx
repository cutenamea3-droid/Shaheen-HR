import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Personal Study is no longer part of this Compliance + Attendance app.
 * Soft landing for old bookmarks — no portal module import / no Personal probes.
 */
function PersonalRemoved() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Personal Study is not in this app
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This deploy serves Driver Compliance and Admin &amp; Attendance only. Personal
          cloud data was not deleted.
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

export const Route = createFileRoute("/personal")({
  head: () => ({
    meta: [
      { title: "Personal not available — Shaheen Transport" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PersonalRemoved,
});
