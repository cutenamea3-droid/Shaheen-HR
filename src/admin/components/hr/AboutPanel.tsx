import { CalendarClock, FileText, ListChecks, Timer } from "lucide-react";

const FEATURES = [
  [CalendarClock, "Smart Attendance", "Daily check-ins, extra day marks and team logs."],
  [FileText, "CEO & Performance Reports", "Monthly reports with auto-calculated scores."],
  [Timer, "Overtime & Extra Days", "Automatic overtime and additional day totals."],
  [ListChecks, "Tasks & Team", "Assign tasks and follow their status live."],
] as const;

/** Admin sign-in marketing column. Credit line lives in the shared login footer. */
export function AboutPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`flex h-full flex-col justify-center gap-6 ${compact ? "lg:pr-2" : ""}`}>
      <div>
        <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl lg:text-[2.65rem]">
          HR &amp; Attendance, <span className="text-primary">made simple.</span>
        </h2>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Optimizing workforce attendance, overtime and executive reporting across all Shaheen
          Transport departments.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([Icon, title, text]) => (
          <div key={title} className="panel ui-lift">
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
