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

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

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

/** Coerce month-close row scalars so Reports never renders object children. */
export function normalizeMonthCloseRecord(raw: unknown, fallbackMonth = ""): MonthCloseRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<MonthCloseRecord>;
  const month = asText(r.month).trim() || asText(fallbackMonth).trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const status: MonthCloseStatus = r.status === "closed" ? "closed" : "open";
  const asTs = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    month,
    status,
    closedAt: asTs(r.closedAt),
    closedBy: asText(r.closedBy),
    reopenReason: asText(r.reopenReason),
    reopenedAt: asTs(r.reopenedAt),
    reopenedBy: asText(r.reopenedBy),
  };
}

export const useMonthClosing = create<State>()(
  persist(
    (set, get) => ({
      months: {},
      closingMeansPaid: false,
      statusOf: (month) => {
        const months =
          get().months && typeof get().months === "object" && !Array.isArray(get().months)
            ? get().months
            : {};
        return months[asText(month)]?.status ?? "open";
      },
      isClosed: (month) => {
        const months =
          get().months && typeof get().months === "object" && !Array.isArray(get().months)
            ? get().months
            : {};
        return (months[asText(month)]?.status ?? "open") === "closed";
      },
      closeMonth: (month, who) => {
        const key = asText(month).trim();
        if (!/^\d{4}-\d{2}$/.test(key)) return { ok: false, error: "Invalid month" };
        if (get().isClosed(key)) return { ok: false, error: "Month already closed" };
        const months =
          get().months && typeof get().months === "object" && !Array.isArray(get().months)
            ? get().months
            : {};
        const prev = months[key] ?? empty(key);
        set({
          months: {
            ...months,
            [key]: {
              ...prev,
              month: key,
              status: "closed",
              closedAt: Date.now(),
              closedBy: asText(who) || "HR",
              reopenReason: "",
              reopenedAt: null,
              reopenedBy: "",
            },
          },
        });
        return { ok: true };
      },
      reopenMonth: (month, who, reason) => {
        const key = asText(month).trim();
        if (!/^\d{4}-\d{2}$/.test(key)) return { ok: false, error: "Invalid month" };
        if (!get().isClosed(key)) return { ok: false, error: "Month is not closed" };
        const trimmed = asText(reason).trim();
        if (!trimmed) return { ok: false, error: "Reopen requires a reason" };
        const months =
          get().months && typeof get().months === "object" && !Array.isArray(get().months)
            ? get().months
            : {};
        const prev = months[key] ?? empty(key);
        set({
          months: {
            ...months,
            [key]: {
              ...prev,
              status: "open",
              reopenReason: trimmed,
              reopenedAt: Date.now(),
              reopenedBy: asText(who) || "HR",
            },
          },
        });
        return { ok: true };
      },
    }),
    {
      name: MONTH_CLOSING_STORAGE_KEY,
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? (persisted as Partial<State>)
            : {};
        const src =
          raw.months && typeof raw.months === "object" && !Array.isArray(raw.months)
            ? raw.months
            : current.months;
        const months: Record<string, MonthCloseRecord> = {};
        for (const [k, v] of Object.entries(src)) {
          const healed = normalizeMonthCloseRecord(v, k);
          if (healed) months[healed.month] = healed;
        }
        return { ...current, ...raw, months, closingMeansPaid: false as const };
      },
    },
  ),
);

/** Pure helper for tests / guards. */
export function monthOfDate(date: unknown): string {
  const s = date == null ? "" : typeof date === "string" ? date : String(date);
  return s.slice(0, 7);
}

/**
 * Whether attendance/performance edits for a calendar date should be blocked.
 * Closing ≠ Paid — this only gates month-period edits, never payment status.
 */
export function isDateInClosedMonth(date: unknown, isClosed: (month: string) => boolean): boolean {
  const s = date == null ? "" : typeof date === "string" ? date : String(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return isClosed(monthOfDate(s));
}
