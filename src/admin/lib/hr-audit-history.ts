/**
 * Admin HR Audit History — structured events for reports, closing, follow-ups.
 * Separate from SystemLogs activity feed; never invents attendance/performance.
 * Dedicated local key — not HR_SYNC_KEYS / banking.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HrAuditKind =
  | "month_close"
  | "month_reopen"
  | "pdf_management"
  | "pdf_audit"
  | "pdf_employee"
  | "perf_followup_add"
  | "perf_followup_done"
  | "reminder_add"
  | "reminder_done";

export type HrAuditEvent = {
  id: string;
  at: number;
  who: string;
  kind: HrAuditKind;
  detail: string;
  month?: string;
  employeeId?: string;
};

export const HR_AUDIT_STORAGE_KEY = "hr-audit-history-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

const KIND_SET = new Set<string>(Object.keys({
  month_close: 1,
  month_reopen: 1,
  pdf_management: 1,
  pdf_audit: 1,
  pdf_employee: 1,
  perf_followup_add: 1,
  perf_followup_done: 1,
  reminder_add: 1,
  reminder_done: 1,
} satisfies Record<HrAuditKind, 1>));

/** Coerce audit event scalars so React never receives object children. */
export function normalizeHrAuditEvent(raw: unknown): HrAuditEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Partial<HrAuditEvent>;
  const kindRaw = asText(e.kind);
  if (!KIND_SET.has(kindRaw)) return null;
  const at =
    typeof e.at === "number" && Number.isFinite(e.at)
      ? e.at
      : Number.isFinite(Number(e.at))
        ? Number(e.at)
        : Date.now();
  const month = asText(e.month).trim();
  const employeeId = asText(e.employeeId);
  return {
    id: asText(e.id).trim() || uid(),
    at,
    who: asText(e.who) || "HR",
    kind: kindRaw as HrAuditKind,
    detail: asText(e.detail),
    ...(month ? { month } : {}),
    ...(employeeId ? { employeeId } : {}),
  };
}

export const AUDIT_KIND_LABEL: Record<HrAuditKind, string> = {
  month_close: "Month closed",
  month_reopen: "Month reopened",
  pdf_management: "Management Summary PDF",
  pdf_audit: "Full HR Audit PDF",
  pdf_employee: "Individual Employee Report PDF",
  perf_followup_add: "Performance follow-up added",
  perf_followup_done: "Performance follow-up completed",
  reminder_add: "HR reminder added",
  reminder_done: "HR reminder completed",
};

type State = {
  events: HrAuditEvent[];
  record: (input: Omit<HrAuditEvent, "id" | "at"> & { at?: number }) => HrAuditEvent;
  forMonth: (month: string) => HrAuditEvent[];
  recent: (limit?: number) => HrAuditEvent[];
};

export const useHrAuditHistory = create<State>()(
  persist(
    (set, get) => ({
      events: [],
      record: (input) => {
        const month = asText(input.month).trim();
        const employeeId = asText(input.employeeId);
        const ev: HrAuditEvent = {
          id: uid(),
          at:
            typeof input.at === "number" && Number.isFinite(input.at) ? input.at : Date.now(),
          who: asText(input.who) || "HR",
          kind: input.kind,
          detail: asText(input.detail),
          ...(month ? { month } : {}),
          ...(employeeId ? { employeeId } : {}),
        };
        const prev = Array.isArray(get().events) ? get().events : [];
        set({ events: [ev, ...prev].slice(0, 1000) });
        return ev;
      },
      forMonth: (month) => {
        const list = Array.isArray(get().events) ? get().events : [];
        const key = asText(month);
        return list.filter((e) => asText(e.month) === key);
      },
      recent: (limit = 50) => {
        const list = Array.isArray(get().events) ? get().events : [];
        return list.slice(0, limit);
      },
    }),
    {
      name: HR_AUDIT_STORAGE_KEY,
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? (persisted as Partial<State>)
            : {};
        const list = Array.isArray(raw.events) ? raw.events : current.events;
        return {
          ...current,
          ...raw,
          events: list
            .map((e) => normalizeHrAuditEvent(e))
            .filter((e): e is HrAuditEvent => !!e),
        };
      },
    },
  ),
);
