import { useEffect } from "react";
import { Btn, Empty, Panel, SectionHead, courseLabel } from "./common";
import { todayKey, usePersonal } from "@/personal/lib/store";
import { STUDY_MODE_MINUTES, type StudyMode } from "@/personal/lib/types";

const MODES: { id: StudyMode; blurb: string }[] = [
  { id: "normal", blurb: "Full workday budget — ~2 hours focused study" },
  { id: "busy", blurb: "Compressed day — 45 minutes of high-signal work" },
  { id: "rescue", blurb: "Emergency slice — 20 minutes to protect the streak" },
];

export function Timetable() {
  const courses = usePersonal((s) => s.courses);
  const dayPlans = usePersonal((s) => s.dayPlans);
  const ensureDayPlan = usePersonal((s) => s.ensureDayPlan);
  const setDayMode = usePersonal((s) => s.setDayMode);
  const setDayBlockDone = usePersonal((s) => s.setDayBlockDone);
  const rebuildDayBlocks = usePersonal((s) => s.rebuildDayBlocks);
  const settings = usePersonal((s) => s.settings);

  const today = todayKey();
  useEffect(() => {
    ensureDayPlan(today);
  }, [ensureDayPlan, today]);

  const plan = dayPlans[today];
  const used = plan?.blocks.reduce((s, b) => s + b.minutes, 0) ?? 0;
  const budget = plan ? STUDY_MODE_MINUTES[plan.mode] : settings.dailyTargetMinutes;

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Smart timetable"
          subtitle="Pick a day mode. Blocks rebuild from backlog — no fake lecture scheduling."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => {
            const active = plan?.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setDayMode(today, m.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  active
                    ? "border-[var(--hp-violet)] bg-[var(--hp-violet)]/15 shadow-[0_0_0_1px_var(--hp-violet)]"
                    : "border-[var(--hp-border)] bg-[var(--hp-elevated)] hover:border-[var(--hp-violet)]/50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="hp-title text-lg font-bold capitalize">{m.id}</span>
                  <span className="text-2xl font-bold tabular-nums text-[var(--hp-teal)]">
                    {STUDY_MODE_MINUTES[m.id]}
                    <span className="text-sm font-semibold text-[var(--hp-muted)]">m</span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--hp-muted)]">{m.blurb}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-[var(--hp-muted)]">
            Today · allocated {used}m / {budget}m
          </span>
          <Btn variant="ghost" onClick={() => rebuildDayBlocks(today)}>
            Rebuild from backlog
          </Btn>
        </div>
      </Panel>

      <Panel>
        <SectionHead title="Today’s blocks" subtitle={`${today} · mark only what you actually finish`} />
        {!plan?.blocks.length ? (
          <Empty>Empty plan. Add backlog recovery items, then rebuild.</Empty>
        ) : (
          <ol className="space-y-2">
            {plan.blocks.map((b, i) => (
              <li
                key={b.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--hp-border)] px-3 py-3 ${
                  b.done ? "opacity-55" : "bg-[var(--hp-elevated)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="hp-title mt-0.5 text-sm font-bold text-[var(--hp-violet)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="font-semibold">{b.label}</div>
                    <div className="text-xs text-[var(--hp-muted)]">
                      {courseLabel(courses, b.courseId)} · {b.minutes} minutes
                    </div>
                  </div>
                </div>
                <Btn
                  variant={b.done ? "ghost" : "teal"}
                  onClick={() => setDayBlockDone(today, b.id, !b.done)}
                >
                  {b.done ? "Undo" : "Complete"}
                </Btn>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
