import { CloudUpload, FileWarning, HeartPulse, Users } from "lucide-react";

const FEATURES = [
  [FileWarning, "DOT & DMV Pull Notices", "License status monitoring and record audits."],
  [HeartPulse, "Medical & CDL Tracking", "Expiry alerts and renewal schedules."],
  [Users, "Unified Driver Directory", "Drivers, owner operators and mechanics linked."],
  [CloudUpload, "Multi-Device Cloud Sync", "Your data on every browser, instantly."],
] as const;

/** Marketing column for portal sign-in. Credit line lives in the shared login footer. */
export function AboutPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`flex h-full flex-col justify-center gap-6 ${compact ? "lg:pr-2" : ""}`}
    >
      <div>
        <h2 className="text-3xl font-extrabold leading-tight text-foreground md:text-4xl lg:text-[2.65rem]">
          Driver Compliance, <span className="text-primary">under control.</span>
        </h2>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Ensuring 100% DOT readiness, proactive driver safety tracking and simple document
          management for Shaheen Transport LLC.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([Icon, title, text]) => (
          <div key={title} className="ui-lift rounded-2xl border bg-card p-4 shadow-card">
            <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <p className="font-bold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
