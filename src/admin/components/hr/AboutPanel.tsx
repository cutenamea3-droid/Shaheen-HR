import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, FileText, ListChecks, Timer } from "lucide-react";

const FEATURES = [
  [CalendarClock, "Smart Attendance", "Daily check-ins, extra day marks and team logs."],
  [FileText, "CEO & Performance Reports", "Monthly reports with auto-calculated scores."],
  [Timer, "Overtime & Extra Days", "Automatic overtime and additional day totals."],
  [ListChecks, "Tasks & Team", "Assign tasks and follow their status live."],
] as const;

export function AboutPanel() {
  return (
    <section className="flex flex-col justify-center gap-6">
      <Link
        to="/cv"
        preload="intent"
        title="View Yousaf's CV"
        className="ui-press ui-glow inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary"
      >
        <BadgeCheck className="h-4 w-4" /> Made by HR <span className="opacity-70">· View CV →</span>
      </Link>
      <div>
        <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">
          HR & Attendance, <span className="text-primary">made simple.</span>
        </h2>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Yousaf · HR Operations & Administration</p>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Optimizing workforce attendance, overtime and executive reporting across all Shaheen Transport departments.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([Icon, title, text]) => (
          <div key={title} className="panel">
            <div className="brand-gradient mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <p className="font-bold">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
