import { leaveBalance, monthDays } from "./calc";
import type { DayRec, Employee } from "./types";

export type LeaveDayEntry = {
  date: string;
  employeeId: string;
  paid: boolean;
  note: string;
};

export type LeaveRosterRow = {
  employeeId: string;
  name: string;
  balanceAsOf: number;
  paidThisMonth: number;
  unpaidThisMonth: number;
  openingLeave: number;
  joinMonth: string;
};

/** Existing leave days for a month — derived from attendance records only. */
export function listLeaveDaysInMonth(
  month: string,
  employees: Employee[],
  records: Record<string, Record<string, DayRec>>,
): LeaveDayEntry[] {
  const out: LeaveDayEntry[] = [];
  for (const d of monthDays(month)) {
    const day = records[d];
    if (!day) continue;
    for (const e of employees) {
      const r = day[e.id];
      if (r?.status === "leave") {
        out.push({
          date: d,
          employeeId: e.id,
          paid: !!r.leavePaid,
          note: r.note ?? "",
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
}

/** Roster using existing leaveBalance / openingLeave / joinMonth accrual — no new policy. */
export function leaveRoster(
  employees: Employee[],
  records: Record<string, Record<string, DayRec>>,
  asOf: string,
): LeaveRosterRow[] {
  const month = asOf.slice(0, 7);
  return employees.map((e) => {
    let paidThisMonth = 0;
    let unpaidThisMonth = 0;
    for (const d of monthDays(month)) {
      if (d > asOf) continue;
      const r = records[d]?.[e.id];
      if (r?.status !== "leave") continue;
      if (r.leavePaid) paidThisMonth++;
      else unpaidThisMonth++;
    }
    return {
      employeeId: e.id,
      name: e.name,
      balanceAsOf: leaveBalance(e, asOf, records),
      paidThisMonth,
      unpaidThisMonth,
      openingLeave: e.openingLeave,
      joinMonth: e.joinMonth,
    };
  });
}

export function leaveDaysOnDate(
  date: string,
  employees: Employee[],
  records: Record<string, Record<string, DayRec>>,
): LeaveDayEntry[] {
  const day = records[date] ?? {};
  return employees
    .filter((e) => day[e.id]?.status === "leave")
    .map((e) => ({
      date,
      employeeId: e.id,
      paid: !!day[e.id]!.leavePaid,
      note: day[e.id]!.note ?? "",
    }));
}
