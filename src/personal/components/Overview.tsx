import { useEffect } from "react";
import { Btn, Empty, Panel, SectionHead, Stat, courseLabel } from "./common";
import {
  consistencyDays,
  studyMinutesInRange,
  todayKey,
  usePersonal,
} from "@/personal/lib/store";
import { STUDY_MODE_MINUTES } from "@/personal/lib/types";

export function Overview() {
  const courses = usePersonal((s) => s.courses);
  const backlog = usePersonal((s) => s.backlog);
  const sessions = usePersonal((s) => s.sessions);
  const assessments = usePersonal((s) => s.assessments);
  const settings = usePersonal((s) => s.settings);
  const dayPlans = usePersonal((s) => s.dayPlans);
  const ensureDayPlan = usePersonal((s) => s.ensureDayPlan);
  const setDayMode = usePersonal((s) => s.setDayMode);

  const today = todayKey();
  useEffect(() => {
    ensureDayPlan(today);
  }, [ensureDayPlan, today]);

  const plan = dayPlans[today];
  const openBacklog = backlog.filter((b) => !b.done).length;
  const weekMs = 7 * 86400000;
  const minutes7d = studyMinutesInRange(sessions, Date.now() - weekMs, Date.now());
  const daysActive = consistencyDays(sessions, 14);
  const upcoming = assessments
    .filter((a) => !a.done)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  const tracked = courses.filter(
    (c) => c.lecturesTotal != null && c.lecturesDone != null && c.lecturesTotal > 0,
  );

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Command center"
          subtitle={`${settings.program} · ${settings.semester} · ~2h / workday target`}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Logged (7d)"
            value={`${minutes7d}m`}
            hint={minutes7d === 0 ? "No sessions yet — start Focus to log real time" : "From Focus sessions only"}
            accent="teal"
          />
          <Stat
            label="Open backlog"
            value={String(openBacklog)}
            hint="Recovery items you added"
            accent="amber"
          />
          <Stat
            label="Active days (14d)"
            value={`${daysActive}`}
            hint="Days with at least one logged session"
            accent="blue"
          />
          <Stat
            label="Today mode"
            value={plan ? `${STUDY_MODE_MINUTES[plan.mode]}m` : "—"}
            hint={plan ? plan.mode : "Preparing plan…"}
            accent="violet"
          />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionHead
            title="Today’s recovery plan"
            subtitle="Built from your backlog — never invents lecture progress"
            action={
              <div className="flex flex-wrap gap-1">
                {(["normal", "busy", "rescue"] as const).map((m) => (
                  <Btn
                    key={m}
                    variant={plan?.mode === m ? "primary" : "ghost"}
                    className="capitalize"
                    onClick={() => setDayMode(today, m)}
                  >
                    {m} {STUDY_MODE_MINUTES[m]}
                  </Btn>
                ))}
              </div>
            }
          />
          {!plan?.blocks.length ? (
            <Empty>No blocks yet. Add backlog items or keep a Normal study slot.</Empty>
          ) : (
            <ul className="space-y-2">
              {plan.blocks.map((b) => (
                <li
                  key={b.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border border-[var(--hp-border)] px-3 py-2 ${
                    b.done ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--hp-ink)]">{b.label}</div>
                    <div className="text-xs text-[var(--hp-muted)]">
                      {courseLabel(courses, b.courseId)} · {b.minutes}m
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--hp-teal)]">
                    {b.done ? "Done" : "Queued"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <SectionHead
            title="Upcoming assessments"
            subtitle="Reference dates — verify on VULMS before relying on them"
          />
          {!upcoming.length ? (
            <Empty>No open assessments. Add quizzes or assignments when you know them.</Empty>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[var(--hp-border)] px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold">{a.title}</div>
                    <div className="text-xs text-[var(--hp-muted)]">
                      {a.dueDate}
                      {a.verifyOnVulms ? " · verify on VULMS" : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-[var(--hp-violet)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--hp-violet)]">
                    {a.kind}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[var(--hp-muted)]">
            Midterm ref {settings.midtermRef} · Finals ref {settings.finalsRef}
          </p>
        </Panel>
      </div>

      <Panel>
        <SectionHead
          title="Course pulse"
          subtitle="Progress shows only when you enter lecture counts — blanks mean not tracked"
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const has =
              c.lecturesTotal != null && c.lecturesDone != null && c.lecturesTotal > 0;
            const pct = has
              ? Math.min(100, Math.round(((c.lecturesDone ?? 0) / (c.lecturesTotal ?? 1)) * 100))
              : null;
            return (
              <div
                key={c.id}
                className="rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--hp-ink)]">{c.code}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hp-muted)]">
                    {pct == null ? "Not tracked" : `${pct}%`}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-[var(--hp-muted)]">{c.title}</div>
                {pct != null ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--hp-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--hp-violet)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-[var(--hp-muted)]">
                    Enter totals in Courses when known
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {tracked.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--hp-muted)]">
            No invented completion — lecture tracking starts empty until you fill it.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
