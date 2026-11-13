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
        const title = input.title.trim();
        if (!title) return { error: "Title required" };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return { error: "Due date required" };
        const r: HrReminder = {
          id: uid(),
          title,
          due: input.due,
          employeeId: input.employeeId ?? "",
          employeeName: input.employeeName ?? "",
          status: "open",
          note: (input.note ?? "").trim(),
          createdAt: Date.now(),
          completedAt: null,
        };
        set({ reminders: [r, ...get().reminders] });
        return r;
      },
      complete: (id) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, status: "done", completedAt: Date.now() } : r,
          ),
        })),
      reopen: (id) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, status: "open", completedAt: null } : r,
          ),
        })),
      remove: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
      dueOnOrBefore: (date) =>
        get().reminders.filter((r) => r.status === "open" && r.due <= date),
      openCount: (date) => get().dueOnOrBefore(date).length,
    }),
    { name: HR_REMINDERS_STORAGE_KEY },
  ),
);
