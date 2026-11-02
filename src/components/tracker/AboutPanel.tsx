import { Link } from "@tanstack/react-router";
import { BadgeCheck, CloudUpload, FileWarning, HeartPulse, Users } from "lucide-react";

const FEATURES = [
  [FileWarning, "DOT & DMV Pull Notices", "License status monitoring and record audits."],
  [HeartPulse, "Medical & CDL Tracking", "Expiry alerts and renewal schedules."],
  [Users, "Unified Driver Directory", "Drivers, owner operators and mechanics linked."],
  [CloudUpload, "Multi-Device Cloud Sync", "Your data on every browser, instantly."],
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
        <BadgeCheck className="size-4" /> Made by HR <span className="opacity-70">· View CV →</span>
      </Link>
      <div>
        <h2 className="text-3xl font-extrabold leading-tight text-foreground md:text-4xl">
          Driver Compliance, <span className="text-primary">under control.</span>
        </h2>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Yousaf · HR & Compliance Specialist</p>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Ensuring 100% DOT readiness, proactive driver safety tracking and simple document management for Shaheen Transport LLC.
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
