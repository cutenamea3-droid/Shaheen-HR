import type { Task } from "./types";

/**
 * Cloud / legacy local payloads sometimes omit `doneDays` on daily tasks.
 * TaskGate and My HR Today call `.includes` on that field — missing → post-paint crash
 * right after Cloud Saved applies app_state.
 */
export function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = raw as Record<string, unknown>;
  const idRaw = t.id == null ? "" : typeof t.id === "string" ? t.id : String(t.id);
  const id = idRaw.trim() ? idRaw : null;
  const title = t.title == null ? "" : typeof t.title === "string" ? t.title : String(t.title);
  const kind = t.kind === "daily" ? "daily" : t.kind === "dated" ? "dated" : null;
  const dueRaw = t.due == null ? "" : typeof t.due === "string" ? t.due : String(t.due);
  const due = dueRaw.trim();
  if (!id || !kind || !due) return null;
  const doneDays = Array.isArray(t.doneDays)
    ? t.doneDays
        .map((d) => (d == null ? "" : typeof d === "string" ? d : String(d)))
        .filter(Boolean)
    : [];
  return {
    id,
    title,
    kind,
    due,
    done: Boolean(t.done),
    doneDays,
  };
}

export function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  const out: Task[] = [];
  for (const row of raw) {
    const n = normalizeTask(row);
    if (n) out.push(n);
  }
  return out;
}

/** Patch an HR payload (cloud or local) so task accessors never throw. Does not delete other keys. */
export function withNormalizedTasks<T extends Record<string, unknown>>(payload: T): T {
  if (!("tasks" in payload)) return payload;
  return { ...payload, tasks: normalizeTasks(payload.tasks) };
}

export function taskDoneDays(t: Pick<Task, "doneDays"> | { doneDays?: string[] | null }): string[] {
  return Array.isArray(t.doneDays) ? t.doneDays : [];
}
