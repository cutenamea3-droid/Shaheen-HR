import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { calcDay, fmtHours, fmtTime, monthDays, prettyDate, shortDate, type DayCalc } from "./calc";
import { RATING_LABEL, type DayRec, type Dept, type Employee, type Perf, type Rating, type Settings } from "./types";

export type Tone = "red" | "green" | "blue";
export type Cell = { t: string; c?: Tone | undefined };
export type Table = { title: string; head: string[]; rows: Cell[][]; widths?: number[]; noWrapFirst?: boolean };
export type Data = {
  depts: Dept[];
  employees: Employee[];
  records: Record<string, Record<string, DayRec>>;
  perf: Record<string, Record<string, Perf>>;
  settings: Settings;
};

const C = (t: string | number, c?: Tone): Cell => ({ t: String(t), c });
export const ratingTone = (r: Rating | ""): Tone | undefined =>
  r === "excellent" ? "blue" : r === "good" ? "green" : r === "needs" || r === "poor" ? "red" : undefined;
const shiftText = (d?: Dept) => (d ? `${fmtTime(d.start)} – ${fmtTime(d.end)}` : "—");

export function autoNote(c: DayCalc) {
  return c.violations.join(" · ");
}

function punchCell(rec: DayRec, c: DayCalc, k: "in" | "bin" | "bout" | "out"): Cell {
  if (rec.status === "leave") return C("Leave");
  if (rec.status === "absent") return C("Absent", "red");
  if ((k === "bin" || k === "bout") && (c.isSat || rec.noBreak)) return C("No break");
  if (c.missing.includes(k)) return C("Miss punch", "red");
  const v = rec[k];
  const tone = (k === "in" && c.lateLevel === "late") || ((k === "bin" || k === "bout") && c.breakLevel === "over") ? "red" : undefined;
  return C(fmtTime(v), tone);
}

function dayRows(data: Data, date: string) {
  const day = data.records[date] ?? {};
  return data.employees
    .map((e, i) => ({ e, i, rec: day[e.id], dept: data.depts.find((d) => d.id === e.deptId) }))
    .filter((x) => x.rec)
    .map((x) => ({ ...x, c: calcDay(x.e, x.dept, date, x.rec!, data.settings), p: data.perf[date]?.[x.e.id] }));
}

function attendanceCells(x: ReturnType<typeof dayRows>[number]): Cell[] {
  const { rec, c } = x as { rec: DayRec; c: DayCalc };
  const remarks = c.flags.join(" · ") || "On time";
  return [
    C(x.i + 1),
    C(x.e.name),
    C(x.dept?.name ?? "—"),
    C(c.isSat ? `Sat target ${x.dept ? "" : ""}` .trim() || shiftText(x.dept) : shiftText(x.dept)),
    punchCell(rec, c, "in"),
    punchCell(rec, c, "bin"),
    punchCell(rec, c, "bout"),
    punchCell(rec, c, "out"),
    C(c.breakTaken != null ? `${c.breakTaken}m` : "—", c.breakLevel === "over" ? "red" : undefined),
    C(c.worked != null ? fmtHours(c.worked) : "—", c.satTargetMiss ? "red" : undefined),
    C(c.overtimeMin ? fmtHours(c.overtimeMin) : "—"),
    C(remarks, c.violations.length ? "red" : undefined),
    C(rec.note),
  ];
}

const ATT_HEAD = ["#", "Employee", "Dept", "Shift", "Punch in", "Break in", "Break out", "Punch out", "Break", "Hours", "Over time", "Remarks", "Note / reason"];

export function dailyAttendance(data: Data, date: string): Table {
  return { title: `Daily Attendance Report — ${prettyDate(date)}`, head: ATT_HEAD, rows: dayRows(data, date).map(attendanceCells) };
}

export function dailyPerformance(data: Data, date: string): Table {
  const rows = dayRows(data, date).map((x) => {
    const tone = ratingTone(x.p?.rating ?? "");
    return [
      C(x.i + 1),
      C(x.e.name),
      C(x.dept?.name ?? "—"),
      C(x.p?.rating ? RATING_LABEL[x.p.rating] : "Not rated", tone),
      C(autoNote(x.c) || "None", x.c.violations.length ? "red" : undefined),
      C(x.p?.note ?? "", tone),
    ];
  });
  return { title: `Daily Performance Report — ${prettyDate(date)}`, head: ["#", "Employee", "Dept", "Performance", "Violations", "Performance note"], rows };
}

export function dailyCombined(data: Data, date: string): Table {
  const rows = dayRows(data, date).map((x) => {
    const tone = ratingTone(x.p?.rating ?? "");
    const a = attendanceCells(x);
    return [...a.slice(0, 3), ...a.slice(4, 10), a[10]!, a[11]!, C(x.p?.rating ? RATING_LABEL[x.p.rating] : "—", tone), C([x.rec!.note, x.p?.note].filter(Boolean).join(" | "), tone)];
  });
  return {
    title: `Daily Attendance & Performance — ${prettyDate(date)}`,
    head: ["#", "Employee", "Dept", "Punch in", "Break in", "Break out", "Punch out", "Break", "Hours", "Over time", "Remarks", "Rating", "Notes"],
    rows,
  };
}

function monthCalcs(data: Data, month: string, e: Employee) {
  const dept = data.depts.find((d) => d.id === e.deptId);
  return monthDays(month)
    .filter((d) => data.records[d]?.[e.id])
    .map((d) => {
      const rec = data.records[d]![e.id]!;
      return { d, rec, c: calcDay(e, dept, d, rec, data.settings), p: data.perf[d]?.[e.id] };
    });
}

/** Long names use just the first name so the notes column never wraps. */
export const shortName = (n: string) => (n.trim().length > 14 ? n.trim().split(/\s+/)[0]! : n.trim());

const list = (items: string[]) => (items.length ? `${items.length}\n${items.join("\n")}` : "0");

export function monthlyAttendance(data: Data, month: string): Table[] {
  const rows: Cell[][] = [];
  const notes: Cell[][] = [];
  data.employees.forEach((e, i) => {
    const m = monthCalcs(data, month, e);
    const worked = m.filter((x) => x.rec.status === "present" || x.rec.status === "half");
    const grace = m.filter((x) => x.c.lateLevel === "grace").map((x) => `${shortDate(x.d)}: ${x.c.lateMin}m`);
    const late = m.filter((x) => x.c.lateLevel === "late").map((x) => `${shortDate(x.d)}: ${x.c.lateMin}m`);
    const ob = m.filter((x) => x.c.breakLevel === "over").map((x) => `${shortDate(x.d)}: ${x.c.overBreak}m`);
    const miss = m.filter((x) => x.c.missPunch).map((x) => shortDate(x.d));
    const halfs = m.filter((x) => x.rec.status === "half").map((x) => `${shortDate(x.d)}${x.rec.halfReason ? `: ${x.rec.halfReason}` : ""}`);
    const sat = m.filter((x) => x.c.satTargetMiss).map((x) => shortDate(x.d));
    const paid = m.filter((x) => x.rec.status === "leave" && x.rec.leavePaid).length;
    const unpaid = m.filter((x) => x.rec.status === "leave" && !x.rec.leavePaid).length;
    const absent = m.filter((x) => x.rec.status === "absent").length;
    const hours = worked.reduce((a, x) => a + (x.c.worked ?? 0), 0);
    rows.push([
      C(i + 1),
      C(e.name),
      C(data.depts.find((d) => d.id === e.deptId)?.name ?? "—"),
      C(worked.length),
      C(fmtHours(hours)),
      C(list(grace)),
      C(list(late), late.length ? "red" : undefined),
      C(list(ob), ob.length ? "red" : undefined),
      C(list(miss), miss.length ? "red" : undefined),
      C(list(halfs)),
      C(paid),
      C(unpaid, unpaid ? "red" : undefined),
      C(absent, absent ? "red" : undefined),
      C(list(sat), sat.length ? "red" : undefined),
    ]);
    m.filter((x) => x.rec.note || x.p?.note).forEach((x) =>
      notes.push([C(shortName(e.name)), C(shortDate(x.d)), C(x.rec.note), C(x.p?.note ?? "")]),
    );
  });
  return [
    {
      title: `Monthly Attendance Report — ${monthLabel(month)}`,
      head: ["#", "Employee", "Dept", "Working days", "Hours", "Late (under grace)", "Late (after grace)", "Over break", "Miss punches", "Half days", "Paid leave", "Unpaid leave", "Absent", "Sat target missed"],
      rows,
    },
    { noWrapFirst: true, title: "Reasons & notes", head: ["Employee", "Date", "Attendance note / reason", "Performance note"], rows: notes },
  ];
}

export function monthlyPerformance(data: Data, month: string): Table[] {
  const rows: Cell[][] = [];
  const notes: Cell[][] = [];
  data.employees.forEach((e, i) => {
    const m = monthCalcs(data, month, e);
    const cnt = (r: Rating) => m.filter((x) => x.p?.rating === r).length;
    const bad = m.filter((x) => x.p?.rating === "needs" || x.p?.rating === "poor").map((x) => `${shortDate(x.d)}: ${RATING_LABEL[x.p!.rating as Rating]}`);
    const viol = m.filter((x) => x.c.violations.length).map((x) => `${shortDate(x.d)}: ${x.c.violations.join(", ")}`);
    rows.push([
      C(i + 1),
      C(e.name),
      C(cnt("excellent"), cnt("excellent") ? "blue" : undefined),
      C(cnt("good"), cnt("good") ? "green" : undefined),
      C(cnt("average")),
      C(list(bad), bad.length ? "red" : undefined),
      C(list(viol), viol.length ? "red" : undefined),
    ]);
    m.filter((x) => x.p?.note).forEach((x) => notes.push([C(shortName(e.name)), C(shortDate(x.d)), C(x.p?.rating ? RATING_LABEL[x.p.rating] : "—", ratingTone(x.p!.rating)), C(x.p!.note, ratingTone(x.p!.rating))]));
  });
  return [
    { title: `Monthly Performance Report — ${monthLabel(month)}`, head: ["#", "Employee", "Excellent", "Good", "Average", "Needs impr. / Poor", "Violation days"], rows },
    { noWrapFirst: true, title: "Performance notes", head: ["Employee", "Date", "Rating", "Note"], rows: notes },
  ];
}

export function monthlyOvertime(data: Data, month: string): Table[] {
  const rows: Cell[][] = [];
  data.employees.forEach((e, i) => {
    const m = monthCalcs(data, month, e);
    const ot = m.filter((x) => x.c.overtimeMin > 0);
    const ex = m.filter((x) => x.c.extraDay);
    if (!ot.length && !ex.length) return;
    rows.push([
      C(i + 1),
      C(e.name),
      C(e.afterHours ? "After-hours" : "Normal"),
      C(list(ot.map((x) => `${shortDate(x.d)}: ${fmtHours(x.c.overtimeMin)}h`))),
      C(fmtHours(ot.reduce((a, x) => a + x.c.overtimeMin, 0))),
      C(list(ex.map((x) => `${shortDate(x.d)}: ${fmtHours(x.c.extraDayMin)}h`))),
      C(fmtHours(ex.reduce((a, x) => a + x.c.extraDayMin, 0))),
    ]);
  });
  return [
    {
      title: `Overtime & Additional Days — ${monthLabel(month)}`,
      head: ["#", "Employee", "Type", "Over time days", "Over time hours", "Additional days", "Additional day hours"],
      rows,
    },
  ];
}

export function monthLabel(month: string) {
  const [y = 2026, m = 1] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const TONE: Record<Tone, [number, number, number]> = { red: [200, 30, 30], green: [20, 130, 60], blue: [25, 80, 200] };

let logoData: string | null = null;
async function loadLogo() {
  if (logoData) return logoData;
  try {
    const b = await (await fetch("/logo.jpg")).blob();
    logoData = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(b);
    });
  } catch {
    logoData = null;
  }
  return logoData;
}

export async function downloadPdf(tables: Table[], company: string, filename: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();
  if (logo) doc.addImage(logo, "JPEG", 30, 14, 40, 48);
  let y = 44;
  doc.setFont("helvetica", "bold").setFontSize(15).text(company, logo ? 78 : 30, y);
  doc.setFont("helvetica", "normal").setFontSize(9).text("Prepared by HR Department", W - 30, y, { align: "right" });
  y += 8;
  tables.forEach((t, ti) => {
    if (ti === 0) y += 16;
    else y += 14;
    doc.setFont("helvetica", "bold").setFontSize(12).text(t.title, 30, y + 14);
    autoTable(doc, {
      startY: y + 22,
      head: [t.head],
      body: t.rows.map((r) => r.map((c) => c.t)),
      theme: "grid",
      margin: { left: 30, right: 30 },
      styles: { fontSize: 8.5, cellPadding: 4, overflow: "linebreak", valign: "top", lineColor: [90, 90, 90], lineWidth: 0.5, textColor: [20, 20, 20] },
      headStyles: { fillColor: [235, 238, 240], textColor: [20, 20, 20], fontStyle: "bold", lineWidth: 0.6 },
      columnStyles: t.noWrapFirst ? { 0: { cellWidth: "wrap" }, 1: { cellWidth: "wrap" } } : { 0: { cellWidth: 22, halign: "center" } },
      didParseCell: (h) => {
        if (h.section !== "body") return;
        const tone = t.rows[h.row.index]?.[h.column.index]?.c;
        if (tone) {
          h.cell.styles.textColor = TONE[tone];
          h.cell.styles.fontStyle = "bold";
        }
      },
    });
    if (!t.rows.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fy = (doc as any).lastAutoTable.finalY;
      doc.setFont("helvetica", "italic").setFontSize(9).text("No entries.", 30, fy + 12);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > doc.internal.pageSize.getHeight() - 80 && ti < tables.length - 1) {
      doc.addPage();
      y = 30;
    }
  });
  doc.save(filename);
}

export function downloadCsv(tables: Table[], filename: string) {
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\n/g, "; ")}"`;
  const out = tables
    .map((t) => [esc(t.title), t.head.map(esc).join(","), ...t.rows.map((r) => r.map((c) => esc(c.t)).join(","))].join("\n"))
    .join("\n\n");
  const blob = new Blob(["\ufeff" + out], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Inclusive YYYY-MM-DD range (local calendar days). */
export function datesInRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  const cur = new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const end = new Date(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export type PayrollRow = {
  name: string;
  department: string;
  regularShiftHours: number;
  overtimeHours: number;
  additionalDayHours: number;
  daysPresent: number;
  daysAbsent: number;
};

/**
 * Payroll rollup for a date range. Reuses calcDay — does not alter formulas.
 * Regular = worked − overtime on non-extra days; on double-shift days = worked − extraDayMin.
 * Overtime / additional day hours come from calcDay.overtimeMin / extraDayMin.
 */
export function payrollSummary(data: Data, from: string, to: string): PayrollRow[] {
  const days = datesInRange(from, to);
  return data.employees.map((e) => {
    const dept = data.depts.find((d) => d.id === e.deptId);
    let regularMin = 0;
    let overtimeMin = 0;
    let additionalMin = 0;
    let daysPresent = 0;
    let daysAbsent = 0;
    for (const d of days) {
      const rec = data.records[d]?.[e.id];
      if (!rec) continue;
      if (rec.status === "absent") {
        daysAbsent++;
        continue;
      }
      if (rec.status === "leave") continue;
      if (rec.status === "present" || rec.status === "half") daysPresent++;
      const c = calcDay(e, dept, d, rec, data.settings);
      if (c.extraDay) {
        additionalMin += c.extraDayMin;
        // Double shift: base portion stays regular; pure additional days are all extraDayMin.
        if (rec.doubleShift && c.worked != null) {
          regularMin += Math.max(0, c.worked - c.extraDayMin);
        }
      } else {
        overtimeMin += c.overtimeMin;
        if (c.worked != null) regularMin += Math.max(0, c.worked - c.overtimeMin);
      }
    }
    return {
      name: e.name,
      department: dept?.name ?? "—",
      regularShiftHours: +fmtHours(regularMin),
      overtimeHours: +fmtHours(overtimeMin),
      additionalDayHours: +fmtHours(additionalMin),
      daysPresent,
      daysAbsent,
    };
  });
}

const PAYROLL_HEAD = [
  "Employee Name",
  "Department",
  "Regular Shift Hours",
  "Overtime Hours",
  "Additional Day/Double Shift Hours",
  "Total Days Present",
  "Total Days Absent",
];

export function downloadPayrollCsv(data: Data, from: string, to: string, monthLabel = from.slice(0, 7)) {
  const rows = payrollSummary(data, from, to);
  // CSV cells are string | number (hours already .toFixed strings; day counts are numbers).
  // esc already coerces via String(s) — widen the param for exact typing only (no output change).
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [
    PAYROLL_HEAD.map(esc).join(","),
    ...rows.map((r) =>
      [
        r.name,
        r.department,
        r.regularShiftHours.toFixed(2),
        r.overtimeHours.toFixed(2),
        r.additionalDayHours.toFixed(2),
        r.daysPresent,
        r.daysAbsent,
      ]
        .map(esc)
        .join(","),
    ),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Shaheen_Payroll_Summary_${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
