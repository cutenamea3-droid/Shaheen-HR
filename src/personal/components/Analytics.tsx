import { Panel, SectionHead, Stat } from "./common";
import {
  consistencyDays,
  studyMinutesInRange,
  usePersonal,
} from "@/personal/lib/store";

export function Analytics() {
  const sessions = usePersonal((s) => s.sessions);
  const backlog = usePersonal((s) => s.backlog);
  const courses = usePersonal((s) => s.courses);
  const dayPlans = usePersonal((s) => s.dayPlans);

  const now = Date.now();
  const m7 = studyMinutesInRange(sessions, now - 7 * 86400000, now);
  const m30 = studyMinutesInRange(sessions, now - 30 * 86400000, now);
  const days14 = consistencyDays(sessions, 14);
  const openBacklog = backlog.filter((b) => !b.done).length;
  const recovered = backlog.filter((b) => b.done).length;

  const byCourse = courses.map((c) => ({
    code: c.code,
    minutes: sessions
      .filter((s) => s.courseId === c.id)
      .reduce((sum, s) => sum + s.minutes, 0),
  }));

  const plansDone = Object.values(dayPlans).reduce(
    (acc, p) => {
      acc.total += p.blocks.length;
      acc.done += p.blocks.filter((b) => b.done).length;
      return acc;
    },
    { total: 0, done: 0 },
  );

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Performance analytics"
          subtitle="Study minutes, backlog, consistency — zero invented progress"
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="7-day minutes" value={`${m7}`} hint="Logged Focus only" accent="teal" />
          <Stat label="30-day minutes" value={`${m30}`} hint="Logged Focus only" accent="blue" />
          <Stat
            label="Consistency (14d)"
            value={`${days14}/14`}
            hint="Days with ≥1 session"
            accent="violet"
          />
          <Stat
            label="Backlog"
            value={`${openBacklog}`}
            hint={`${recovered} recovered`}
            accent="amber"
          />
        </div>
        {sessions.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-3 text-sm text-[var(--hp-muted)]">
            Charts stay empty until you log real Focus time. No demo grades or fake completion.
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionHead title="Minutes by course" subtitle="Derived from Focus sessions" />
          <ul className="space-y-2">
            {byCourse.map((row) => {
              const max = Math.max(1, ...byCourse.map((r) => r.minutes));
              const w = Math.round((row.minutes / max) * 100);
              return (
                <li key={row.code}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{row.code}</span>
                    <span className="tabular-nums text-[var(--hp-muted)]">{row.minutes}m</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hp-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--hp-blue)]"
                      style={{ width: `${row.minutes ? w : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <SectionHead title="Plan completion" subtitle="Blocks you marked done on timetables" />
          <div className="hp-title text-4xl font-bold tabular-nums">
            {plansDone.done}
            <span className="text-lg text-[var(--hp-muted)]"> / {plansDone.total}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--hp-muted)]">
            Only counts blocks you explicitly completed. Empty when you have not used Timetable yet.
          </p>
        </Panel>
      </div>
    </div>
  );
}
