/**
 * Verified monthly rollups for PDF export.
 * Reuses calcDay — does not alter attendance / OT / performance formulas.
 */
import { calcDay, fmtHours, monthDays, shortDate, type DayCalc } from "./calc";
import { RATING_LABEL, type DayRec, type Employee, type Perf, type Rating } from "./types";
import type { Data } from "./reports";

export type MonthlyPdfMode = "management" | "audit";

export type MonthDayRow = {
  date: string;
  rec: DayRec;
  c: DayCalc;
  p?: Perf;
};

export type EmpMonth = {
  index: number;
  employee: Employee;
  deptName: string;
  days: MonthDayRow[];
  workingDays: number;
  hoursMin: number;
  graceCount: number;
  lateCount: number;
  overBreakCount: number;
  missPunchCount: number;
  halfCount: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  satMissCount: number;
  ratingCounts: Record<Rating, number>;
  violationDays: number;
  otMin: number;
  otDays: number;
  extraMin: number;
  extraDays: number;
  afterHours: boolean;
};

export type ExceptionItem = {
  employee: string;
  dept: string;
  date: string;
  kind: string;
  detail: string;
};

export type NoteItem = {
  employee: string;
  dept: string;
  date: string;
  source: "attendance" | "performance";
  rating?: string;
  text: string;
};

export type OtItem = {
  employee: string;
  dept: string;
  type: string;
  otDays: string[];
  otHours: string;
  extraDays: string[];
  extraHours: string;
};

export type MonthlyOverview = {
  month: string;
  monthLabel: string;
  rosterCount: number;
  employeesWithRecords: number;
  totalWorkingDays: number;
  totalHours: string;
  totalLate: number;
  totalGrace: number;
  totalOverBreak: number;
  totalMissPunch: number;
  totalAbsent: number;
  totalPaidLeave: number;
  totalUnpaidLeave: number;
  totalHalf: number;
  totalSatMiss: number;
  totalOtHours: string;
  totalExtraHours: string;
  ratingTotals: Record<Rating, number>;
  notesCount: number;
  exceptionCount: number;
  deptsRepresented: number;
};

export type MonthlyReportModel = {
  month: string;
  monthLabel: string;
  overview: MonthlyOverview;
  employees: EmpMonth[];
  attendanceRows: EmpMonth[];
  exceptions: ExceptionItem[];
  notes: NoteItem[];
  otRows: OtItem[];
};

export function monthLabel(month: string) {
  const [y = 2026, m = 1] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function emptyRatings(): Record<Rating, number> {
  return { excellent: 0, good: 0, average: 0, needs: 0, poor: 0 };
}

function monthCalcs(data: Data, month: string, e: Employee): MonthDayRow[] {
  const dept = data.depts.find((d) => d.id === e.deptId);
  return monthDays(month)
    .filter((d) => data.records[d]?.[e.id])
    .map((d) => {
      const rec = data.records[d]![e.id]!;
      return { date: d, rec, c: calcDay(e, dept, d, rec, data.settings), p: data.perf[d]?.[e.id] };
    });
}

function buildEmpMonth(data: Data, month: string, e: Employee, index: number): EmpMonth {
  const days = monthCalcs(data, month, e);
  const worked = days.filter((x) => x.rec.status === "present" || x.rec.status === "half");
  const ratingCounts = emptyRatings();
  for (const x of days) {
    const r = x.p?.rating;
    if (r) ratingCounts[r]++;
  }
  const ot = days.filter((x) => x.c.overtimeMin > 0);
  const ex = days.filter((x) => x.c.extraDay);
  return {
    index,
    employee: e,
    deptName: data.depts.find((d) => d.id === e.deptId)?.name ?? "—",
    days,
    workingDays: worked.length,
    hoursMin: worked.reduce((a, x) => a + (x.c.worked ?? 0), 0),
    graceCount: days.filter((x) => x.c.lateLevel === "grace").length,
    lateCount: days.filter((x) => x.c.lateLevel === "late").length,
    overBreakCount: days.filter((x) => x.c.breakLevel === "over").length,
    missPunchCount: days.filter((x) => x.c.missPunch).length,
    halfCount: days.filter((x) => x.rec.status === "half").length,
    paidLeave: days.filter((x) => x.rec.status === "leave" && x.rec.leavePaid).length,
    unpaidLeave: days.filter((x) => x.rec.status === "leave" && !x.rec.leavePaid).length,
    absent: days.filter((x) => x.rec.status === "absent").length,
    satMissCount: days.filter((x) => x.c.satTargetMiss).length,
    ratingCounts,
    violationDays: days.filter((x) => x.c.violations.length).length,
    otMin: ot.reduce((a, x) => a + x.c.overtimeMin, 0),
    otDays: ot.length,
    extraMin: ex.reduce((a, x) => a + x.c.extraDayMin, 0),
    extraDays: ex.length,
    afterHours: e.afterHours,
  };
}

function collectExceptions(emp: EmpMonth): ExceptionItem[] {
  const out: ExceptionItem[] = [];
  for (const x of emp.days) {
    const base = { employee: emp.employee.name, dept: emp.deptName, date: shortDate(x.date) };
    if (x.c.lateLevel === "late") out.push({ ...base, kind: "Late (after grace)", detail: `${x.c.lateMin}m` });
    if (x.c.breakLevel === "over") out.push({ ...base, kind: "Over break", detail: `${x.c.overBreak}m` });
    if (x.c.missPunch) out.push({ ...base, kind: "Miss punch", detail: x.c.missing.join(", ") || "miss" });
    if (x.rec.status === "absent") out.push({ ...base, kind: "Absent", detail: "—" });
    if (x.rec.status === "leave" && !x.rec.leavePaid) out.push({ ...base, kind: "Unpaid leave", detail: "—" });
    if (x.rec.status === "half") out.push({ ...base, kind: "Half day", detail: x.rec.halfReason || "—" });
    if (x.c.satTargetMiss) out.push({ ...base, kind: "Sat target missed", detail: "—" });
  }
  return out;
}

function collectNotes(emp: EmpMonth): NoteItem[] {
  const out: NoteItem[] = [];
  for (const x of emp.days) {
    if (x.rec.note?.trim()) {
      out.push({
        employee: emp.employee.name,
        dept: emp.deptName,
        date: shortDate(x.date),
        source: "attendance",
        text: x.rec.note.trim(),
      });
    }
    if (x.p?.note?.trim()) {
      const item: NoteItem = {
        employee: emp.employee.name,
        dept: emp.deptName,
        date: shortDate(x.date),
        source: "performance",
        text: x.p.note.trim(),
      };
      if (x.p.rating) item.rating = RATING_LABEL[x.p.rating];
      out.push(item);
    }
  }
  return out;
}

export function buildMonthlyReportModel(data: Data, month: string): MonthlyReportModel {
  const employees = data.employees.map((e, i) => buildEmpMonth(data, month, e, i + 1));
  const withRecords = employees.filter((e) => e.days.length > 0);
  const exceptions = withRecords.flatMap(collectExceptions);
  const notes = withRecords.flatMap(collectNotes);
  const ratingTotals = emptyRatings();
  for (const e of withRecords) {
    (Object.keys(ratingTotals) as Rating[]).forEach((r) => {
      ratingTotals[r] += e.ratingCounts[r];
    });
  }
  const depts = new Set(withRecords.map((e) => e.deptName));
  const overview: MonthlyOverview = {
    month,
    monthLabel: monthLabel(month),
    rosterCount: data.employees.length,
    employeesWithRecords: withRecords.length,
    totalWorkingDays: withRecords.reduce((a, e) => a + e.workingDays, 0),
    totalHours: fmtHours(withRecords.reduce((a, e) => a + e.hoursMin, 0)),
    totalLate: withRecords.reduce((a, e) => a + e.lateCount, 0),
    totalGrace: withRecords.reduce((a, e) => a + e.graceCount, 0),
    totalOverBreak: withRecords.reduce((a, e) => a + e.overBreakCount, 0),
    totalMissPunch: withRecords.reduce((a, e) => a + e.missPunchCount, 0),
    totalAbsent: withRecords.reduce((a, e) => a + e.absent, 0),
    totalPaidLeave: withRecords.reduce((a, e) => a + e.paidLeave, 0),
    totalUnpaidLeave: withRecords.reduce((a, e) => a + e.unpaidLeave, 0),
    totalHalf: withRecords.reduce((a, e) => a + e.halfCount, 0),
    totalSatMiss: withRecords.reduce((a, e) => a + e.satMissCount, 0),
    totalOtHours: fmtHours(withRecords.reduce((a, e) => a + e.otMin, 0)),
    totalExtraHours: fmtHours(withRecords.reduce((a, e) => a + e.extraMin, 0)),
    ratingTotals,
    notesCount: notes.length,
    exceptionCount: exceptions.length,
    deptsRepresented: depts.size,
  };

  const otRows: OtItem[] = withRecords
    .filter((e) => e.otDays > 0 || e.extraDays > 0)
    .map((e) => {
      const ot = e.days.filter((x) => x.c.overtimeMin > 0);
      const ex = e.days.filter((x) => x.c.extraDay);
      return {
        employee: e.employee.name,
        dept: e.deptName,
        type: e.afterHours ? "After-hours" : "Normal",
        otDays: ot.map((x) => `${shortDate(x.date)}: ${fmtHours(x.c.overtimeMin)}h`),
        otHours: fmtHours(e.otMin),
        extraDays: ex.map((x) => `${shortDate(x.date)}: ${fmtHours(x.c.extraDayMin)}h`),
        extraHours: fmtHours(e.extraMin),
      };
    });

  return {
    month,
    monthLabel: overview.monthLabel,
    overview,
    employees,
    attendanceRows: withRecords,
    exceptions,
    notes,
    otRows,
  };
}

/** Cross-check model totals against a direct calcDay pass (same rules). */
export function verifyMonthlyTotals(data: Data, month: string, model: MonthlyReportModel) {
  let hoursMin = 0;
  let late = 0;
  let otMin = 0;
  let extraMin = 0;
  let absent = 0;
  for (const e of data.employees) {
    const dept = data.depts.find((d) => d.id === e.deptId);
    for (const d of monthDays(month)) {
      const rec = data.records[d]?.[e.id];
      if (!rec) continue;
      const c = calcDay(e, dept, d, rec, data.settings);
      if (rec.status === "present" || rec.status === "half") hoursMin += c.worked ?? 0;
      if (c.lateLevel === "late") late++;
      if (c.overtimeMin > 0) otMin += c.overtimeMin;
      if (c.extraDay) extraMin += c.extraDayMin;
      if (rec.status === "absent") absent++;
    }
  }
  return {
    hoursMatch: model.overview.totalHours === fmtHours(hoursMin),
    lateMatch: model.overview.totalLate === late,
    otMatch: model.overview.totalOtHours === fmtHours(otMin),
    extraMatch: model.overview.totalExtraHours === fmtHours(extraMin),
    absentMatch: model.overview.totalAbsent === absent,
    hoursMin,
    late,
    otMin,
    extraMin,
    absent,
  };
}

