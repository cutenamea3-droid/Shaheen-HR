/**
 * Monthly Closing / Reopen for Admin & Attendance.
 *
 * HARD:
 * - Closing ≠ Paid (never touches salary payment status).
 * - Not in HR_SYNC_KEYS / unprotected app_state banking.
 * - Reopen requires a reason; audit events recorded separately.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MonthCloseStatus = "open" | "closed";

export type MonthCloseRecord = {
  month: string; // YYYY-MM
  status: MonthCloseStatus;
  closedAt: number | null;
  closedBy: string;
  reopenReason: string;
  reopenedAt: number | null;
  reopenedBy: string;
};

/** Dedicated browser key — never add to HR_SYNC_KEYS. */
export const MONTH_CLOSING_STORAGE_KEY = "hr-month-closing-v1";

type State = {
  months: Record<string, MonthCloseRecord>;
  closeMonth: (month: string, who: string) => { ok: true } | { ok: false; error: string };
  reopenMonth: (month: string, who: string, reason: string) => { ok: true } | { ok: false; error: string };
  statusOf: (month: string) => MonthCloseStatus;
  isClosed: (month: string) => boolean;
  /** Explicit: closing never implies salary paid. */
  closingMeansPaid: false;
};

function empty(month: string): MonthCloseRecord {
  return {
    month,
    status: "open",
    closedAt: null,
    closedBy: "",
    reopenReason: "",
    reopenedAt: null,
    reopenedBy: "",
  };
}

export const useMonthClosing = create<State>()(
  persist(
    (set, get) => ({
      months: {},
      closingMeansPaid: false,
      statusOf: (month) => get().months[month]?.status ?? "open",
      isClosed: (month) => (get().months[month]?.status ?? "open") === "closed",
      closeMonth: (month, who) => {
        if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Invalid month" };
        if (get().isClosed(month)) return { ok: false, error: "Month already closed" };
        const prev = get().months[month] ?? empty(month);
        set({
          months: {
            ...get().months,
            [month]: {
              ...prev,
              month,
              status: "closed",
              closedAt: Date.now(),
              closedBy: who || "HR",
              reopenReason: "",
              reopenedAt: null,
              reopenedBy: "",
            },
          },
        });
        return { ok: true };
      },
      reopenMonth: (month, who, reason) => {
        if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Invalid month" };
        if (!get().isClosed(month)) return { ok: false, error: "Month is not closed" };
        const trimmed = reason.trim();
        if (!trimmed) return { ok: false, error: "Reopen requires a reason" };
        const prev = get().months[month] ?? empty(month);
        set({
          months: {
            ...get().months,
            [month]: {
              ...prev,
              status: "open",
              reopenReason: trimmed,
              reopenedAt: Date.now(),
              reopenedBy: who || "HR",
            },
          },
        });
        return { ok: true };
      },
    }),
    { name: MONTH_CLOSING_STORAGE_KEY },
  ),
);

/** Pure helper for tests / guards. */
export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

/**
 * Whether attendance/performance edits for a calendar date should be blocked.
 * Closing ≠ Paid — this only gates month-period edits, never payment status.
 */
export function isDateInClosedMonth(date: string, isClosed: (month: string) => boolean): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return isClosed(monthOfDate(date));
}
