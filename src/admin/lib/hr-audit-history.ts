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

type State = {
  events: HrAuditEvent[];
  record: (input: Omit<HrAuditEvent, "id" | "at"> & { at?: number }) => HrAuditEvent;
  forMonth: (month: string) => HrAuditEvent[];
  recent: (limit?: number) => HrAuditEvent[];
};

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

export const useHrAuditHistory = create<State>()(
  persist(
    (set, get) => ({
      events: [],
      record: (input) => {
        const ev: HrAuditEvent = {
          id: uid(),
          at: input.at ?? Date.now(),
          who: input.who || "HR",
          kind: input.kind,
          detail: input.detail,
          ...(input.month ? { month: input.month } : {}),
          ...(input.employeeId ? { employeeId: input.employeeId } : {}),
        };
        set({ events: [ev, ...get().events].slice(0, 1000) });
        return ev;
      },
      forMonth: (month) => get().events.filter((e) => e.month === month),
      recent: (limit = 50) => get().events.slice(0, limit),
    }),
    { name: HR_AUDIT_STORAGE_KEY },
  ),
);
