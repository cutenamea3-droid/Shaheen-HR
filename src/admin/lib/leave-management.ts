import { leaveBalance, monthDays } from "./calc";
import type { DayRec, Employee } from "./types";

const asText = (v: unknown): string => (v == null ? "" : typeof v === "string" ? v : String(v));

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
  const roster = Array.isArray(employees) ? employees : [];
  const days =
    records && typeof records === "object" && !Array.isArray(records) ? records : {};
  const out: LeaveDayEntry[] = [];
  for (const d of monthDays(month)) {
    const day = days[d];
    if (!day) continue;
    for (const e of roster) {
      const r = day[e.id];
      if (r?.status === "leave") {
        out.push({
          date: d,
          employeeId: e.id,
          paid: !!r.leavePaid,
          note: asText(r.note),
        });
      }
    }
  }
  return out.sort(
    (a, b) =>
      asText(a.date).localeCompare(asText(b.date)) ||
      asText(a.employeeId).localeCompare(asText(b.employeeId)),
  );
}

/** Roster using existing leaveBalance / openingLeave / joinMonth accrual — no new policy. */
export function leaveRoster(
  employees: Employee[],
  records: Record<string, Record<string, DayRec>>,
  asOf: string,
): LeaveRosterRow[] {
  const asOfDay = asOf == null ? "" : typeof asOf === "string" ? asOf : String(asOf);
  const month = asOfDay.slice(0, 7);
  const roster = Array.isArray(employees) ? employees : [];
  const days =
    records && typeof records === "object" && !Array.isArray(records) ? records : {};
  return roster.map((e) => {
    let paidThisMonth = 0;
    let unpaidThisMonth = 0;
    for (const d of monthDays(month)) {
      if (d > asOfDay) continue;
      const r = days[d]?.[e.id];
      if (r?.status !== "leave") continue;
      if (r.leavePaid) paidThisMonth++;
      else unpaidThisMonth++;
    }
    return {
      employeeId: asText(e.id),
      name: asText(e.name),
      balanceAsOf: leaveBalance(e, asOfDay, days),
      paidThisMonth,
      unpaidThisMonth,
      openingLeave:
        typeof e.openingLeave === "number" && Number.isFinite(e.openingLeave)
          ? e.openingLeave
          : Number.isFinite(Number(e.openingLeave))
            ? Number(e.openingLeave)
            : 0,
      joinMonth: asText(e.joinMonth),
    };
  });
}

export function leaveDaysOnDate(
  date: string,
  employees: Employee[],
  records: Record<string, Record<string, DayRec>>,
): LeaveDayEntry[] {
  const roster = Array.isArray(employees) ? employees : [];
  const days =
    records && typeof records === "object" && !Array.isArray(records) ? records : {};
  const day = days[date] ?? {};
  return roster
    .filter((e) => day[e.id]?.status === "leave")
    .map((e) => ({
      date,
      employeeId: e.id,
      paid: !!day[e.id]!.leavePaid,
      note: asText(day[e.id]!.note),
    }));
}
