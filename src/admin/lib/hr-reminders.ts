/**
 * HR Reminders — desk list for My HR Today.
 * Not push/email. Dedicated local key — never HR_SYNC_KEYS / banking.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HrReminderStatus = "open" | "done";

export type HrReminder = {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  status: HrReminderStatus;
  note: string;
  createdAt: number;
  completedAt: number | null;
};

export const HR_REMINDERS_STORAGE_KEY = "hr-reminders-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

/** Coerce reminder scalars from corrupt local persist before due/title compares. */
export function normalizeHrReminder(raw: unknown): HrReminder | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<HrReminder>;
  const id = asText(r.id).trim() || uid();
  const due = asText(r.due).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  const status: HrReminderStatus = r.status === "done" ? "done" : "open";
  const createdAt =
    typeof r.createdAt === "number" && Number.isFinite(r.createdAt)
      ? r.createdAt
      : Number.isFinite(Number(r.createdAt))
        ? Number(r.createdAt)
        : Date.now();
  const completedAt =
    r.completedAt == null
      ? null
      : typeof r.completedAt === "number" && Number.isFinite(r.completedAt)
        ? r.completedAt
        : Number.isFinite(Number(r.completedAt))
          ? Number(r.completedAt)
          : null;
  return {
    id,
    title: asText(r.title),
    due,
    employeeId: asText(r.employeeId),
    employeeName: asText(r.employeeName),
    status,
    note: asText(r.note),
    createdAt,
    completedAt: status === "done" ? completedAt : null,
  };
}

type State = {
  reminders: HrReminder[];
  add: (input: {
    title: string;
    due: string;
    employeeId?: string;
    employeeName?: string;
    note?: string;
  }) => HrReminder | { error: string };
  complete: (id: string) => void;
  reopen: (id: string) => void;
  remove: (id: string) => void;
  dueOnOrBefore: (date: string) => HrReminder[];
  openCount: (date: string) => number;
};

export const useHrReminders = create<State>()(
  persist(
    (set, get) => ({
      reminders: [],
      add: (input) => {
        const title = asText(input.title).trim();
        if (!title) return { error: "Title required" };
        const due = asText(input.due).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Due date required" };
        const r: HrReminder = {
          id: uid(),
          title,
          due,
          employeeId: asText(input.employeeId),
          employeeName: asText(input.employeeName),
          status: "open",
          note: asText(input.note).trim(),
          createdAt: Date.now(),
          completedAt: null,
        };
        const prev = Array.isArray(get().reminders) ? get().reminders : [];
        set({ reminders: [r, ...prev] });
        return r;
      },
      complete: (id) =>
        set((s) => {
          const list = Array.isArray(s.reminders) ? s.reminders : [];
          return {
            reminders: list.map((r) =>
              r.id === id ? { ...r, status: "done", completedAt: Date.now() } : r,
            ),
          };
        }),
      reopen: (id) =>
        set((s) => {
          const list = Array.isArray(s.reminders) ? s.reminders : [];
          return {
            reminders: list.map((r) =>
              r.id === id ? { ...r, status: "open", completedAt: null } : r,
            ),
          };
        }),
      remove: (id) =>
        set((s) => {
          const list = Array.isArray(s.reminders) ? s.reminders : [];
          return { reminders: list.filter((r) => r.id !== id) };
        }),
      dueOnOrBefore: (date) => {
        const list = Array.isArray(get().reminders) ? get().reminders : [];
        const day = asText(date);
        return list.filter((r) => r.status === "open" && asText(r.due) <= day);
      },
      openCount: (date) => get().dueOnOrBefore(date).length,
    }),
    {
      name: HR_REMINDERS_STORAGE_KEY,
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? (persisted as Partial<State>)
            : {};
        const list = Array.isArray(raw.reminders) ? raw.reminders : current.reminders;
        return {
          ...current,
          ...raw,
          reminders: list
            .map((r) => normalizeHrReminder(r))
            .filter((r): r is HrReminder => !!r),
        };
      },
    },
  ),
);
