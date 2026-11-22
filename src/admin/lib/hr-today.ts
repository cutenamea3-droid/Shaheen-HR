import { calcDay } from "./calc";
import { leaveDaysOnDate, leaveRoster } from "./leave-management";
import { normalizeTasks, taskDoneDays } from "./normalize-tasks";
import { resolveDeptAsOf } from "./shift-assignment";
import { shiftVariance } from "./shift-variance";
import { hrSyncStatusLabel, type HrSyncUi } from "./hr-sync-status";
import type { DayRec, Dept, Employee, Settings, Task } from "./types";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));
const empName = (e: Pick<Employee, "name" | "id">) => asText(e.name) || asText(e.id);

export type HrTodayIssueKind =
  | "missing"
  | "leave"
  | "absent"
  | "late"
  | "early_out"
  | "miss_punch"
  | "review_note"
  | "low_leave_balance"
  | "bank_missing";

export type HrTodayIssue = {
  kind: HrTodayIssueKind;
  employeeId: string;
  name: string;
  detail: string;
  /** Suggested Admin tab to open. */
  openTab: "attendance" | "leave" | "directory" | "team";
};

export type HrTodaySummary = {
  date: string;
  entered: number;
  total: number;
  onLeave: number;
  absent: number;
  missing: number;
  lateAfterGrace: number;
  earlyOut: number;
  missPunch: number;
  needsReview: number;
  lowLeaveBalances: number;
  bankMissing: number;
  issues: HrTodayIssue[];
};

function needsReviewNote(c: ReturnType<typeof calcDay>, rec: DayRec): boolean {
  return (
    c.missPunch ||
    (rec.in != null && rec.out == null) ||
    (c.lateLevel === "late" && !rec.note) ||
    (c.breakLevel === "over" && !rec.note)
  );
}

/**
 * Daily HR work-center rollup from existing attendance / leave / finance completeness.
 * Display-only — does not change payroll calc.
 */
export function buildHrToday(opts: {
  date: string;
  employees: Employee[];
  depts: Dept[];
  records: Record<string, Record<string, DayRec>>;
  settings: Settings;
  /** employeeIds with incomplete bank profile (from finance mock/secure). */
  bankMissingIds?: Set<string> | string[];
  lowLeaveThreshold?: number;
}): HrTodaySummary {
  const date = opts.date;
  const employees = Array.isArray(opts.employees) ? opts.employees : [];
  const depts = Array.isArray(opts.depts) ? opts.depts : [];
  const records =
    opts.records && typeof opts.records === "object" && !Array.isArray(opts.records) ? opts.records : {};
  const settings = opts.settings;
  const bankMissing = new Set(
    Array.isArray(opts.bankMissingIds)
      ? opts.bankMissingIds
      : opts.bankMissingIds instanceof Set
        ? [...opts.bankMissingIds]
        : [],
  );
  const threshold = opts.lowLeaveThreshold ?? 1;
  const day = records[date] ?? {};
  const issues: HrTodayIssue[] = [];

  let entered = 0;
  let onLeave = 0;
  let absent = 0;
  let missing = 0;
  let lateAfterGrace = 0;
  let earlyOut = 0;
  let missPunch = 0;
  let needsReview = 0;

  for (const e of employees) {
    const rec = day[e.id];
    if (!rec) {
      missing++;
      issues.push({
        kind: "missing",
        employeeId: asText(e.id),
        name: empName(e),
        detail: "No attendance entered",
        openTab: "attendance",
      });
      continue;
    }
    entered++;
    const dept = resolveDeptAsOf(e, depts, date);
    const c = calcDay(e, dept, date, rec, settings);
    const v = shiftVariance(dept, rec, { grace: settings.grace, date, employee: e });

    if (rec.status === "leave") {
      onLeave++;
      issues.push({
        kind: "leave",
        employeeId: asText(e.id),
        name: empName(e),
        detail: rec.leavePaid ? "Paid leave" : "Unpaid leave",
        openTab: "leave",
      });
    } else if (rec.status === "absent") {
      absent++;
      issues.push({
        kind: "absent",
        employeeId: asText(e.id),
        name: empName(e),
        detail: "Marked absent",
        openTab: "attendance",
      });
    }

    if (v.lateLevel === "late") {
      lateAfterGrace++;
      issues.push({
        kind: "late",
        employeeId: asText(e.id),
        name: empName(e),
        detail: `Late +${v.lateMin} min vs assigned shift`,
        openTab: "attendance",
      });
    }
    if (v.earlyOutMin > 0) {
      earlyOut++;
      issues.push({
        kind: "early_out",
        employeeId: asText(e.id),
        name: empName(e),
        detail: `Early out ${v.earlyOutMin} min`,
        openTab: "attendance",
      });
    }
    if (c.missPunch || (rec.in != null && rec.out == null)) {
      missPunch++;
      issues.push({
        kind: "miss_punch",
        employeeId: asText(e.id),
        name: empName(e),
        detail: "Missing punch",
        openTab: "attendance",
      });
    }
    if (needsReviewNote(c, rec)) {
      needsReview++;
      issues.push({
        kind: "review_note",
        employeeId: asText(e.id),
        name: empName(e),
        detail: "Needs review (late/break/miss without note)",
        openTab: "attendance",
      });
    }
  }

  const roster = leaveRoster(employees, records, date);
  let lowLeaveBalances = 0;
  for (const row of roster) {
    if (row.balanceAsOf <= threshold) {
      lowLeaveBalances++;
      issues.push({
        kind: "low_leave_balance",
        employeeId: asText(row.employeeId),
        name: asText(row.name),
        detail: `Paid leave balance ${row.balanceAsOf}`,
        openTab: "leave",
      });
    }
  }

  let bankMissingCount = 0;
  for (const e of employees) {
    if (bankMissing.has(e.id)) {
      bankMissingCount++;
      issues.push({
        kind: "bank_missing",
        employeeId: asText(e.id),
        name: empName(e),
        detail: "Bank profile incomplete",
        openTab: "directory",
      });
    }
  }

  // leaveDaysOnDate keeps leave list aligned with Leave Management (sanity).
  void leaveDaysOnDate(date, employees, records);

  return {
    date,
    entered,
    total: employees.length,
    onLeave,
    absent,
    missing,
    lateAfterGrace,
    earlyOut,
    missPunch,
    needsReview,
    lowLeaveBalances,
    bankMissing: bankMissingCount,
    issues,
  };
}

export function openTasksDue(tasks: Task[] | unknown, date: string): Task[] {
  return normalizeTasks(tasks).filter((t) => {
    if (t.kind === "dated") return !t.done && t.due <= date;
    return !taskDoneDays(t).includes(date) && t.due <= date;
  });
}

/** Map cloud-sync statuses (+ local-only / preview) using Batch 1 labels — no duplicate sync logic. */
export function hrTodaySyncLabel(opts: {
  previewIsolated: boolean;
  localOnly: boolean;
  status: HrSyncUi;
}): string {
  if (opts.previewIsolated) return "Not Synced";
  if (opts.localOnly) return "Sign In Required";
  return hrSyncStatusLabel(opts.status);
}
