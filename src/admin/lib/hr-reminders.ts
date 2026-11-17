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
        const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));
        const title = asText(input.title).trim();
        if (!title) return { error: "Title required" };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return { error: "Due date required" };
        const r: HrReminder = {
          id: uid(),
          title,
          due: input.due,
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
        return list.filter((r) => r.status === "open" && r.due <= date);
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
        return {
          ...current,
          ...raw,
          reminders: Array.isArray(raw.reminders) ? raw.reminders : current.reminders,
        };
      },
    },
  ),
);
