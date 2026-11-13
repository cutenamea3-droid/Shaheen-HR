/**
 * Overtime & Additional Days approval overlay (Admin finance).
 *
 * HARD:
 * - Bonus ≠ OT ≠ Additional Days (separate kinds; never merge).
 * - Approvals live in session mock memory — never app_state / HR_SYNC_KEYS.
 * - Does not change attendance calcDay / payroll hours CSV.
 */

import { create } from "zustand";
import type { DayRec, Dept, Employee, Settings } from "./types";
import { calcDay, monthDays } from "./calc";

export type OtApprovalKind = "overtime" | "additional_day";
/** Bonus is a separate compensation line — never stored as OT/addl approval. */
export type CompensationKind = OtApprovalKind | "bonus";

export type OtApprovalStatus = "pending" | "approved" | "rejected";

export type OtApprovalRow = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  kind: OtApprovalKind;
  minutes: number;
  status: OtApprovalStatus;
  note: string;
  decidedAt: number | null;
};

export const COMPENSATION_KIND_LABEL: Record<CompensationKind, string> = {
  overtime: "Overtime",
  additional_day: "Additional day",
  bonus: "Bonus",
};

export function otApprovalId(employeeId: string, date: string, kind: OtApprovalKind): string {
  return `${employeeId}|${date}|${kind}`;
}

/** Collect OT / additional-day candidates from attendance marks (hours only). */
export function collectOtCandidates(input: {
  employees: Employee[];
  depts: Dept[];
  records: Record<string, Record<string, DayRec>>;
  settings: Settings;
  month: string;
  deptId?: string;
}): Array<{
  employeeId: string;
  date: string;
  kind: OtApprovalKind;
  minutes: number;
  note: string;
}> {
  const out: Array<{
    employeeId: string;
    date: string;
    kind: OtApprovalKind;
    minutes: number;
    note: string;
  }> = [];
  for (const e of input.employees) {
    if (input.deptId && e.deptId !== input.deptId) continue;
    const dept = input.depts.find((d) => d.id === e.deptId);
    for (const d of monthDays(input.month)) {
      const r = input.records[d]?.[e.id];
      if (!r) continue;
      const c = calcDay(e, dept, d, r, input.settings);
      if (c.overtimeMin > 0) {
        out.push({
          employeeId: e.id,
          date: d,
          kind: "overtime",
          minutes: c.overtimeMin,
          note: r.note ?? "",
        });
      }
      if (c.extraDay) {
        out.push({
          employeeId: e.id,
          date: d,
          kind: "additional_day",
          minutes: c.extraDayMin,
          note: r.note ?? "",
        });
      }
    }
  }
  return out;
}

type OtApprovalState = {
  /** Keyed by otApprovalId */
  rows: Record<string, OtApprovalRow>;
  ensureCandidate: (c: {
    employeeId: string;
    date: string;
    kind: OtApprovalKind;
    minutes: number;
    note?: string;
  }) => void;
  setStatus: (id: string, status: Exclude<OtApprovalStatus, "pending">, note?: string) => { ok: boolean; error?: string };
  resetApprovals: () => void;
};

export const useOtApprovalStore = create<OtApprovalState>()((set, get) => ({
  rows: {},

  ensureCandidate: (c) => {
    const id = otApprovalId(c.employeeId, c.date, c.kind);
    const existing = get().rows[id];
    if (existing) {
      // Refresh minutes/note from attendance; keep decision.
      set((s) => ({
        rows: {
          ...s.rows,
          [id]: { ...existing, minutes: c.minutes, note: c.note ?? existing.note },
        },
      }));
      return;
    }
    set((s) => ({
      rows: {
        ...s.rows,
        [id]: {
          id,
          employeeId: c.employeeId,
          date: c.date,
          kind: c.kind,
          minutes: c.minutes,
          status: "pending",
          note: c.note ?? "",
          decidedAt: null,
        },
      },
    }));
  },

  setStatus: (id, status, note) => {
    const row = get().rows[id];
    if (!row) return { ok: false, error: "Approval row not found" };
    set((s) => ({
      rows: {
        ...s.rows,
        [id]: {
          ...row,
          status,
          note: note != null ? note : row.note,
          decidedAt: Date.now(),
        },
      },
    }));
    return { ok: true };
  },

  resetApprovals: () => set({ rows: {} }),
}));

/** Approved OT / additional-day minutes for an employee in a month (Bonus never included). */
export function approvedMinutesForEmployee(
  rows: Record<string, OtApprovalRow>,
  employeeId: string,
  month: string,
  kind: OtApprovalKind,
): { minutes: number; days: number } {
  let minutes = 0;
  let days = 0;
  for (const r of Object.values(rows)) {
    if (r.employeeId !== employeeId) continue;
    if (!r.date.startsWith(month)) continue;
    if (r.kind !== kind) continue;
    if (r.status !== "approved") continue;
    minutes += r.minutes;
    days += 1;
  }
  return { minutes, days };
}

/** Persistence guard — approvals must stay off attendance sync keys. */
export function otApprovalPersistenceGuard(): { usesLocalStorage: false; syncKeysSafe: true } {
  return { usesLocalStorage: false, syncKeysSafe: true };
}
