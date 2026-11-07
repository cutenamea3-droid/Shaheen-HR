import { useState } from "react";
import { Btn, Empty, Field, Panel, SectionHead, courseLabel } from "./common";
import { todayKey, usePersonal } from "@/personal/lib/store";

export function Backlog() {
  const courses = usePersonal((s) => s.courses);
  const backlog = usePersonal((s) => s.backlog);
  const addBacklog = usePersonal((s) => s.addBacklog);
  const toggleBacklog = usePersonal((s) => s.toggleBacklog);
  const removeBacklog = usePersonal((s) => s.removeBacklog);
  const rebuildDayBlocks = usePersonal((s) => s.rebuildDayBlocks);

  const [courseId, setCourseId] = useState(courses[0]?.id ?? "cs101");
  const [label, setLabel] = useState("");
  const [mins, setMins] = useState("30");

  const open = backlog.filter((b) => !b.done);
  const done = backlog.filter((b) => b.done);

  return (
    <Panel>
      <SectionHead
        title="Lecture backlog recovery"
        subtitle="Capture missed work yourself — planner never invents lecture debt"
      />
      <form
        className="mb-4 grid gap-3 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3 sm:grid-cols-[1fr_2fr_100px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          addBacklog({
            courseId,
            label: label.trim(),
            estimatedMinutes: Math.max(5, Number(mins) || 30),
          });
          setLabel("");
          rebuildDayBlocks(todayKey());
        }}
      >
        <Field label="Course">
          <select className="hp-field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What to recover">
          <input
            className="hp-field"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Watch missed CS101 video week 3"
          />
        </Field>
        <Field label="Est. min">
          <input className="hp-field" value={mins} onChange={(e) => setMins(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Btn type="submit">Add</Btn>
        </div>
      </form>

      {!open.length ? (
        <Empty>No open recovery items. Add only real missed work.</Empty>
      ) : (
        <ul className="space-y-2">
          {open.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hp-border)] px-3 py-2"
            >
              <div>
                <div className="text-sm font-semibold">{b.label}</div>
                <div className="text-xs text-[var(--hp-muted)]">
                  {courseLabel(courses, b.courseId)} · ~{b.estimatedMinutes}m
                </div>
              </div>
              <div className="flex gap-2">
                <Btn
                  variant="teal"
                  onClick={() => {
                    toggleBacklog(b.id);
                    rebuildDayBlocks(todayKey());
                  }}
                >
                  Mark recovered
                </Btn>
                <Btn variant="ghost" onClick={() => removeBacklog(b.id)}>
                  Remove
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length ? (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--hp-muted)]">
            Recovered
          </h3>
          <ul className="space-y-1 opacity-70">
            {done.map((b) => (
              <li key={b.id} className="flex justify-between text-sm">
                <span>
                  {courseLabel(courses, b.courseId)} — {b.label}
                </span>
                <Btn variant="ghost" onClick={() => toggleBacklog(b.id)}>
                  Undo
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
