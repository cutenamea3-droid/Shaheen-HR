import { useState } from "react";
import { useApp } from "@/admin/lib/store";
import { prettyDate } from "@/admin/lib/calc";
import type { Task } from "@/admin/lib/types";
import { SectionTitle, todayStr } from "./common";

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Dated tasks past due and not done — these block the dashboard. */
export const overdueTasks = (tasks: Task[]) => tasks.filter((t) => t.kind === "dated" && !t.done && t.due < todayStr());
/** Daily tasks not ticked yesterday — alert only. */
export const missedDaily = (tasks: Task[]) => tasks.filter((t) => t.kind === "daily" && t.due <= yesterday() && !t.doneDays.includes(yesterday()));

export function TaskGate() {
  const { tasks, toggleTask } = useApp();
  const [cleared, setCleared] = useState<string[]>([]);
  const over = overdueTasks(tasks);
  const missed = missedDaily(tasks);
  const y = yesterday();
  const pending = over.length + missed.length;
  if (!pending && !cleared.length) return null;
  const finish = (id: string, day?: string) => {
    toggleTask(id, day);
    setCleared((c) => [...c, id]);
    setTimeout(() => setCleared((c) => c.filter((x) => x !== id)), 1500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4">
      <div className={`panel w-full max-w-2xl border-4 ${pending ? "border-destructive" : "border-primary"}`}>
        {pending ? (
          <>
            <h2 className="text-3xl font-extrabold text-destructive">⚠ Tasks not completed</h2>
            <p className="mb-4 text-base text-muted-foreground">These were not done within 24 hours. Complete them to continue.</p>
          </>
        ) : (
          <h2 className="mb-4 text-3xl font-extrabold text-primary">✓ All tasks completed — you're good to go!</h2>
        )}
        <ul className="space-y-3">
          {over.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
              <div>
                <p className="text-xl font-bold">{t.title}</p>
                <p className="text-sm font-semibold text-destructive">Was due {prettyDate(t.due)}</p>
              </div>
              <button className="btn-primary px-5 py-3 text-base" onClick={() => finish(t.id)}>Mark complete</button>
            </li>
          ))}
          {missed.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
              <div>
                <p className="text-xl font-bold">{t.title}</p>
                <p className="text-sm font-semibold text-destructive">Daily task missed on {prettyDate(y)}</p>
              </div>
              <button className="btn-primary px-5 py-3 text-base" onClick={() => finish(t.id, y)}>Mark complete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Tasks() {
  const { tasks, addTask, toggleTask, removeTask } = useApp();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Task["kind"]>("dated");
  const [due, setDue] = useState(todayStr());
  const today = todayStr();
  const missed = missedDaily(tasks);
  return (
    <div>
      <SectionTitle title="My tasks" sub="Dated tasks lock the dashboard once overdue. Daily tasks repeat every day." />
      {missed.length > 0 && (
        <div className="panel mb-4 border-destructive/40 text-sm text-destructive">
          Missed yesterday: {missed.map((t) => t.title).join(", ")}
        </div>
      )}
      <form
        className="panel mb-4 grid gap-3 md:grid-cols-[1fr_160px_170px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addTask({ title: title.trim(), kind, due });
          setTitle("");
        }}
      >
        <label><span className="lbl">Task</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>
          <span className="lbl">Type</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as Task["kind"])}>
            <option value="dated">Due date</option>
            <option value="daily">Every day</option>
          </select>
        </label>
        <label><span className="lbl">{kind === "dated" ? "Due date" : "Starts"}</span><input type="date" className="field" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} /></label>
        <button className="btn-primary">Add task</button>
      </form>
      <div className="space-y-2">
        {tasks.map((t) => {
          const done = t.kind === "dated" ? t.done : t.doneDays.includes(today);
          return (
            <div key={t.id} className="panel flex items-center justify-between gap-3 py-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={done} onChange={() => toggleTask(t.id, today)} />
                <span className={done ? "text-muted-foreground line-through" : "font-semibold"}>{t.title}</span>
              </label>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                {t.kind === "daily" ? "Every day" : prettyDate(t.due)}
                <button className="text-destructive" onClick={() => removeTask(t.id)} aria-label="Delete task">✕</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
