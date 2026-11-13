/**
 * Individual Employee Report PDF — forest green / gold formal branding.
 * Reuses monthly EmpMonth rollups via buildMonthlyReportModel; no banking/salary.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtHours, shortDate } from "./calc";
import { RATING_LABEL, type Rating } from "./types";
import type { Data } from "./reports";
import { buildMonthlyReportModel, monthLabel, type EmpMonth } from "./monthly-report-model";
import { loadLogoDataUrl, PDF_THEME, setLogoCacheForTests } from "./monthly-pdf";

export { setLogoCacheForTests };

const MARGIN = { left: 40, right: 40, top: 72, bottom: 48 };

export type EmployeeReportOptions = {
  company: string;
  month: string;
  employeeId: string;
  generatedAt?: Date;
  logoDataUrl?: string | null;
  returnBytes?: boolean;
};

function drawChrome(
  doc: jsPDF,
  opts: {
    company: string;
    monthLabel: string;
    employeeName: string;
    generatedAt: Date;
    logo: string | null;
    page: number;
    pages: number;
  },
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PDF_THEME.forest);
  doc.rect(0, 0, W, 52, "F");
  doc.setFillColor(...PDF_THEME.gold);
  doc.rect(0, 52, W, 3, "F");
  if (opts.logo) {
    try {
      doc.addImage(opts.logo, "JPEG", 18, 6, 32, 38);
    } catch {
      /* optional */
    }
  }
  const textX = opts.logo ? 58 : 24;
  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(opts.company || "Shaheen Transport LLC", textX, 22);
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  doc.text(`Individual Employee Report — ${opts.monthLabel}`, textX, 36);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(opts.employeeName, W - 24, 22, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text("Prepared by HR Department", W - 24, 36, { align: "right" });
  doc.setDrawColor(...PDF_THEME.gold);
  doc.setLineWidth(0.8);
  doc.line(MARGIN.left, H - 28, W - MARGIN.right, H - 28);
  doc.setTextColor(...PDF_THEME.muted);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`Period: ${opts.monthLabel}  ·  Generated ${opts.generatedAt.toLocaleString("en-US")}`, MARGIN.left, H - 14);
  doc.text(`Page ${opts.page} of ${opts.pages}`, W - MARGIN.right, H - 14, { align: "right" });
}

function section(doc: jsPDF, y: number, letter: string, title: string): number {
  doc.setFillColor(...PDF_THEME.forestSoft);
  doc.roundedRect(MARGIN.left, y, doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right, 22, 3, 3, "F");
  doc.setFillColor(...PDF_THEME.gold);
  doc.rect(MARGIN.left, y, 4, 22, "F");
  doc.setTextColor(...PDF_THEME.forest);
  doc.setFont("helvetica", "bold").setFontSize(11.5);
  doc.text(`Section ${letter} — ${title}`, MARGIN.left + 14, y + 15);
  return y + 30;
}

function renderEmployee(doc: jsPDF, emp: EmpMonth, opts: {
  company: string;
  monthLabel: string;
  generatedAt: Date;
  logo: string | null;
}) {
  const chrome = {
    company: opts.company,
    monthLabel: opts.monthLabel,
    employeeName: emp.employee.name,
    generatedAt: opts.generatedAt,
    logo: opts.logo,
    page: 1,
    pages: 1,
  };
  let y = MARGIN.top;

  y = section(doc, y, "A", "Employee overview");
  doc.setTextColor(...PDF_THEME.charcoal);
  doc.setFont("helvetica", "normal").setFontSize(10.5);
  const lines = [
    `Name: ${emp.employee.name}`,
    `Department: ${emp.deptName}`,
    `Working days: ${emp.workingDays}`,
    `Hours: ${fmtHours(emp.hoursMin)}`,
    `Late / Grace / Over break / Miss punch: ${emp.lateCount} / ${emp.graceCount} / ${emp.overBreakCount} / ${emp.missPunchCount}`,
    `Absent / Paid leave / Unpaid leave / Half: ${emp.absent} / ${emp.paidLeave} / ${emp.unpaidLeave} / ${emp.halfCount}`,
    `OT hours / Additional day hours: ${fmtHours(emp.otMin)} / ${fmtHours(emp.extraMin)}`,
  ];
  for (const line of lines) {
    doc.text(line, MARGIN.left + 6, y);
    y += 16;
  }

  y = section(doc, y + 6, "B", "Daily attendance");
  autoTable(doc, {
    startY: y,
    head: [["Date", "Status", "Hours", "Late", "Break", "OT", "Note"]],
    body: emp.days.map((d) => [
      shortDate(d.date),
      d.rec.status,
      d.rec.status === "present" || d.rec.status === "half" ? fmtHours(d.c.worked ?? 0) : "—",
      d.c.lateLevel === "late" ? `${d.c.lateMin}m` : d.c.lateLevel === "grace" ? `g ${d.c.lateMin}m` : "—",
      d.c.breakLevel === "over" ? `${d.c.overBreak}m` : "—",
      d.c.overtimeMin > 0 ? fmtHours(d.c.overtimeMin) : "—",
      (d.rec.note || "").slice(0, 80),
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: PDF_THEME.charcoal },
    headStyles: { fillColor: PDF_THEME.forest, textColor: PDF_THEME.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: PDF_THEME.zebra },
    margin: { left: MARGIN.left, right: MARGIN.right },
  });
  y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;

  if (y > doc.internal.pageSize.getHeight() - 160) {
    doc.addPage();
    y = MARGIN.top;
  }

  y = section(doc, y, "C", "Performance assessment (ratings only)");
  doc.setFont("helvetica", "italic").setFontSize(9);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text("Assessment ≠ facts ≠ statements. Ratings are HR judgment; facts come from attendance calc.", MARGIN.left + 6, y);
  y += 14;
  const ratingRows = (Object.keys(emp.ratingCounts) as Rating[])
    .filter((r) => emp.ratingCounts[r] > 0)
    .map((r) => [RATING_LABEL[r], String(emp.ratingCounts[r])]);
  autoTable(doc, {
    startY: y,
    head: [["Assessment rating", "Days"]],
    body: ratingRows.length ? ratingRows : [["Not assessed", "0"]],
    styles: { fontSize: 9.5, cellPadding: 3 },
    headStyles: { fillColor: PDF_THEME.forest, textColor: PDF_THEME.white },
    margin: { left: MARGIN.left, right: MARGIN.right },
  });
  y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;

  const notes = emp.days
    .flatMap((d) => {
      const rows: string[][] = [];
      if (d.rec.note?.trim()) rows.push([shortDate(d.date), "Attendance statement", d.rec.note.trim().slice(0, 120)]);
      if (d.p?.note?.trim()) rows.push([shortDate(d.date), "Performance statement", d.p.note.trim().slice(0, 120)]);
      return rows;
    });
  y = section(doc, y, "D", "Statements (recorded text)");
  autoTable(doc, {
    startY: y,
    head: [["Date", "Source", "Statement"]],
    body: notes.length ? notes : [["—", "—", "No statements recorded"]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PDF_THEME.forest, textColor: PDF_THEME.white },
    margin: { left: MARGIN.left, right: MARGIN.right },
  });

  doc.setFont("helvetica", "italic").setFontSize(9);
  doc.setTextColor(...PDF_THEME.muted);
  const endY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y) + 18;
  doc.text(
    "End of employee report — no bank/IBAN/salary. Closing a month ≠ marking salary Paid.",
    MARGIN.left,
    Math.min(endY, doc.internal.pageSize.getHeight() - 40),
  );

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawChrome(doc, { ...chrome, page: p, pages });
  }
}

export function buildEmployeeReportDoc(
  data: Data,
  opts: Omit<EmployeeReportOptions, "returnBytes" | "logoDataUrl"> & { logo?: string | null },
): { doc: jsPDF; emp: EmpMonth | null } {
  const model = buildMonthlyReportModel(data, opts.month);
  const emp = model.employees.find((e) => e.employee.id === opts.employeeId) ?? null;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const generatedAt = opts.generatedAt ?? new Date();
  if (!emp || emp.days.length === 0) {
    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.setTextColor(...PDF_THEME.forest);
    doc.text("No attendance records for this employee in the selected month.", MARGIN.left, MARGIN.top);
    drawChrome(doc, {
      company: opts.company,
      monthLabel: monthLabel(opts.month),
      employeeName: data.employees.find((e) => e.id === opts.employeeId)?.name ?? "Employee",
      generatedAt,
      logo: opts.logo ?? null,
      page: 1,
      pages: 1,
    });
    return { doc, emp };
  }
  renderEmployee(doc, emp, {
    company: opts.company,
    monthLabel: model.monthLabel,
    generatedAt,
    logo: opts.logo ?? null,
  });
  return { doc, emp };
}

export async function downloadEmployeeReportPdf(
  data: Data,
  opts: EmployeeReportOptions,
): Promise<Uint8Array | void> {
  const logo = opts.logoDataUrl !== undefined ? opts.logoDataUrl : await loadLogoDataUrl();
  const { doc, emp } = buildEmployeeReportDoc(data, { ...opts, logo });
  const name = emp?.employee.name.replace(/\s+/g, "-") ?? opts.employeeId;
  const filename = `Shaheen-Employee-Report-${name}-${opts.month}.pdf`;
  if (opts.returnBytes) return new Uint8Array(doc.output("arraybuffer"));
  doc.save(filename);
}
