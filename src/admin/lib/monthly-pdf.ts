/**
 * Premium Shaheen Transport LLC monthly HR PDF — Management Summary & Full HR Audit.
 * Layout / branding only; figures come from buildMonthlyReportModel (calcDay unchanged).
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtHours } from "./calc";
import type { Data } from "./reports";
import {
  buildMonthlyReportModel,
  type EmpMonth,
  type MonthlyPdfMode,
  type MonthlyReportModel,
  type NoteItem,
} from "./monthly-report-model";

export type { MonthlyPdfMode };

/** Forest green + subtle gold + charcoal; restrained warning red. */
export const PDF_THEME = {
  forest: [27, 94, 59] as [number, number, number],
  forestSoft: [232, 242, 236] as [number, number, number],
  gold: [184, 148, 74] as [number, number, number],
  goldSoft: [248, 243, 232] as [number, number, number],
  charcoal: [32, 42, 54] as [number, number, number],
  muted: [90, 100, 112] as [number, number, number],
  line: [200, 208, 200] as [number, number, number],
  warn: [176, 48, 48] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  zebra: [248, 250, 248] as [number, number, number],
};

const MARGIN = { left: 36, right: 36, top: 72, bottom: 48 };
const FONT = 10.5;

export type MonthlyPdfOptions = {
  mode: MonthlyPdfMode;
  company: string;
  month: string;
  generatedAt?: Date;
  logoDataUrl?: string | null;
  /** When set, return bytes instead of triggering browser download. */
  returnBytes?: boolean;
};

let logoCache: string | null | undefined;

export async function loadLogoDataUrl(fetcher: typeof fetch = fetch): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const b = await (await fetcher("/logo.jpg")).blob();
    logoCache = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(b);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/** Test helper — inject logo bytes without fetch. */
export function setLogoCacheForTests(v: string | null | undefined) {
  logoCache = v;
}

function modeTitle(mode: MonthlyPdfMode) {
  return mode === "management" ? "Management Summary" : "Full HR Audit";
}

function fmtStamp(d: Date) {
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function drawPageChrome(
  doc: jsPDF,
  opts: {
    company: string;
    mode: MonthlyPdfMode;
    monthLabel: string;
    generatedAt: Date;
    logo: string | null;
    page: number;
    pages: number;
  },
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  // Header bar
  doc.setFillColor(...PDF_THEME.forest);
  doc.rect(0, 0, W, 52, "F");
  doc.setFillColor(...PDF_THEME.gold);
  doc.rect(0, 52, W, 3, "F");

  if (opts.logo) {
    try {
      doc.addImage(opts.logo, "JPEG", 18, 6, 32, 38);
    } catch {
      /* logo optional */
    }
  }
  const textX = opts.logo ? 58 : 24;
  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(opts.company || "Shaheen Transport LLC", textX, 22);
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  doc.text(`Monthly Combined Report — ${opts.monthLabel}`, textX, 36);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(modeTitle(opts.mode), W - 24, 22, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text("Prepared by HR Department", W - 24, 36, { align: "right" });

  // Footer
  doc.setDrawColor(...PDF_THEME.gold);
  doc.setLineWidth(0.8);
  doc.line(MARGIN.left, H - 28, W - MARGIN.right, H - 28);
  doc.setTextColor(...PDF_THEME.muted);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`Period: ${opts.monthLabel}  ·  Generated ${fmtStamp(opts.generatedAt)}`, MARGIN.left, H - 14);
  doc.text(`Page ${opts.page} of ${opts.pages}`, W - MARGIN.right, H - 14, { align: "right" });
}

function ensureSpace(doc: jsPDF, y: number, need: number, chrome: Parameters<typeof drawPageChrome>[1]): number {
  const H = doc.internal.pageSize.getHeight();
  if (y + need <= H - MARGIN.bottom - 8) return y;
  doc.addPage();
  return MARGIN.top;
}

function sectionTitle(doc: jsPDF, y: number, letter: string, title: string, chrome: Parameters<typeof drawPageChrome>[1]): number {
  y = ensureSpace(doc, y, 36, chrome);
  doc.setFillColor(...PDF_THEME.forestSoft);
  doc.roundedRect(MARGIN.left, y, doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right, 22, 3, 3, "F");
  doc.setFillColor(...PDF_THEME.gold);
  doc.rect(MARGIN.left, y, 4, 22, "F");
  doc.setTextColor(...PDF_THEME.forest);
  doc.setFont("helvetica", "bold").setFontSize(11.5);
  doc.text(`Section ${letter} — ${title}`, MARGIN.left + 14, y + 15);
  return y + 30;
}

function kpiGrid(doc: jsPDF, y: number, items: { label: string; value: string; warn?: boolean }[], chrome: Parameters<typeof drawPageChrome>[1]) {
  const W = doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right;
  const cols = 4;
  const gap = 7;
  const cellW = (W - gap * (cols - 1)) / cols;
  const cellH = 34;
  let x = MARGIN.left;
  let rowY = y;
  items.forEach((it, i) => {
    if (i > 0 && i % cols === 0) {
      rowY += cellH + gap;
      rowY = ensureSpace(doc, rowY, cellH + 4, chrome);
      x = MARGIN.left;
    } else if (i > 0) {
      x += cellW + gap;
    }
    doc.setFillColor(...PDF_THEME.zebra);
    doc.setDrawColor(...PDF_THEME.line);
    doc.roundedRect(x, rowY, cellW, cellH, 3, 3, "FD");
    doc.setTextColor(...PDF_THEME.muted);
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(it.label, x + 8, rowY + 12);
    doc.setTextColor(...(it.warn ? PDF_THEME.warn : PDF_THEME.charcoal));
    doc.setFont("helvetica", "bold").setFontSize(12.5);
    doc.text(it.value, x + 8, rowY + 27);
  });
  const rows = Math.ceil(items.length / cols);
  return rowY + rows * cellH + (rows - 1) * gap + 12;
}

function lastY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((doc as any).lastAutoTable?.finalY as number | undefined) ?? MARGIN.top;
}

type CellInput = string | { content: string; styles?: Record<string, unknown> };

function table(
  doc: jsPDF,
  startY: number,
  head: string[],
  body: CellInput[][],
  opts?: { widths?: Record<string, Partial<{ cellWidth: number | "auto" | "wrap"; halign: "left" | "center" | "right" }>> },
) {
  const options: Parameters<typeof autoTable>[1] = {
    startY,
    head: [head],
    body: body.length ? body : [head.map((_, i) => (i === 0 ? "No entries." : ""))],
    theme: "grid",
    margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: MARGIN.bottom + 10 },
    styles: {
      fontSize: FONT,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      overflow: "linebreak",
      valign: "top",
      lineColor: PDF_THEME.line,
      lineWidth: 0.4,
      textColor: PDF_THEME.charcoal,
      minCellHeight: 16,
    },
    headStyles: {
      fillColor: PDF_THEME.forest,
      textColor: PDF_THEME.white,
      fontStyle: "bold",
      fontSize: FONT,
      lineColor: PDF_THEME.forest,
    },
    alternateRowStyles: { fillColor: PDF_THEME.zebra },
    showHead: "everyPage",
    rowPageBreak: "auto",
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const cell = hook.cell.raw;
      if (cell && typeof cell === "object" && "styles" in (cell as object)) {
        Object.assign(hook.cell.styles, (cell as { styles?: object }).styles ?? {});
      }
    },
  };
  if (opts?.widths) options.columnStyles = opts.widths;
  autoTable(doc, options);
  return lastY(doc) + 14;
}

function warnCell(t: string | number, on: boolean): string | { content: string; styles: { textColor: [number, number, number]; fontStyle: "bold" } } {
  const content = String(t);
  if (!on) return content;
  return { content, styles: { textColor: PDF_THEME.warn, fontStyle: "bold" } };
}

function legend(doc: jsPDF, y: number, chrome: Parameters<typeof drawPageChrome>[1]): number {
  y = ensureSpace(doc, y, 42, chrome);
  doc.setTextColor(...PDF_THEME.charcoal);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("Legend", MARGIN.left, y);
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.muted);
  const lines = [
    "Late (after grace) / Over break / Miss punch / Absent / Unpaid leave / Sat target missed — counted from verified attendance rules.",
    "Red figures highlight exception counts only; this report does not invent disciplinary conclusions or signatures.",
    "Bank / IBAN details are never included in attendance PDFs.",
  ];
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right);
    doc.text(wrapped, MARGIN.left, y);
    y += wrapped.length * 11;
  }
  return y + 6;
}

function renderNotes(
  doc: jsPDF,
  y: number,
  notes: NoteItem[],
  mode: MonthlyPdfMode,
  chrome: Parameters<typeof drawPageChrome>[1],
): number {
  if (mode === "management") {
    const byEmp = new Map<string, number>();
    for (const n of notes) byEmp.set(n.employee, (byEmp.get(n.employee) ?? 0) + 1);
    const rows = [...byEmp.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count], i) => [String(i + 1), name, String(count), "See Full HR Audit for note text"]);
    y = sectionTitle(doc, y, "D", "Reasons & Notes (summary)", chrome);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.setTextColor(...PDF_THEME.muted);
    const blurb = doc.splitTextToSize(
      `${notes.length} note(s) on file across ${byEmp.size} employee(s). Management Summary omits sensitive note text.`,
      doc.internal.pageSize.getWidth() - MARGIN.left - MARGIN.right,
    );
    y = ensureSpace(doc, y, blurb.length * 11 + 8, chrome);
    doc.text(blurb, MARGIN.left, y);
    y += blurb.length * 11 + 8;
    return table(doc, y, ["#", "Employee", "Notes on file", "Detail"], rows, {
      widths: { 0: { cellWidth: 28, halign: "center" }, 2: { cellWidth: 70, halign: "center" } },
    });
  }

  y = sectionTitle(doc, y, "D", "Reasons & Notes (full)", chrome);
  const rows = notes.map((n, i) => [
    String(i + 1),
    n.employee,
    n.date,
    n.source === "attendance" ? "Attendance" : "Performance",
    n.rating ?? "—",
    n.text,
  ]);
  return table(doc, y, ["#", "Employee", "Date", "Source", "Rating", "Note / reason"], rows, {
    widths: {
      0: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 72 },
      3: { cellWidth: 78 },
      4: { cellWidth: 78 },
    },
  });
}

function attendanceBody(rows: EmpMonth[]) {
  // Numeric summary only — day lists live in Section C / D (avoids unreadable multi-line cells).
  return rows.map((e) => [
    String(e.index),
    e.employee.name,
    e.deptName,
    String(e.workingDays),
    fmtHours(e.hoursMin),
    String(e.graceCount),
    warnCell(e.lateCount, e.lateCount > 0),
    warnCell(e.overBreakCount, e.overBreakCount > 0),
    warnCell(e.missPunchCount, e.missPunchCount > 0),
    String(e.halfCount),
    String(e.paidLeave),
    warnCell(e.unpaidLeave, e.unpaidLeave > 0),
    warnCell(e.absent, e.absent > 0),
    warnCell(e.satMissCount, e.satMissCount > 0),
  ]);
}

function renderModel(doc: jsPDF, model: MonthlyReportModel, opts: MonthlyPdfOptions & { logo: string | null; generatedAt: Date }) {
  const chromeBase = {
    company: opts.company,
    mode: opts.mode,
    monthLabel: model.monthLabel,
    generatedAt: opts.generatedAt,
    logo: opts.logo,
    page: 1,
    pages: 1,
  };

  let y = MARGIN.top;
  const o = model.overview;

  y = sectionTitle(doc, y, "A", "Executive Overview", chromeBase);
  y = kpiGrid(
    doc,
    y,
    [
      { label: "Roster", value: String(o.rosterCount) },
      { label: "With records", value: String(o.employeesWithRecords) },
      { label: "Working days (Σ)", value: String(o.totalWorkingDays) },
      { label: "Hours (Σ)", value: o.totalHours },
      { label: "Late after grace", value: String(o.totalLate), warn: o.totalLate > 0 },
      { label: "Grace lates", value: String(o.totalGrace) },
      { label: "Over break", value: String(o.totalOverBreak), warn: o.totalOverBreak > 0 },
      { label: "Miss punches", value: String(o.totalMissPunch), warn: o.totalMissPunch > 0 },
      { label: "Absent", value: String(o.totalAbsent), warn: o.totalAbsent > 0 },
      { label: "Unpaid leave", value: String(o.totalUnpaidLeave), warn: o.totalUnpaidLeave > 0 },
      { label: "OT hours", value: o.totalOtHours },
      { label: "Additional day hrs", value: o.totalExtraHours },
    ],
    chromeBase,
  );
  y = legend(doc, y, chromeBase);

  y = sectionTitle(doc, y, "B", "Attendance Summary", chromeBase);
  y = table(
    doc,
    y,
    [
      "#",
      "Employee",
      "Dept",
      "Days",
      "Hours",
      "Grace",
      "Late",
      "O.Brk",
      "Miss",
      "Half",
      "Paid LV",
      "Unpaid",
      "Absent",
      "Sat miss",
    ],
    attendanceBody(model.attendanceRows),
    {
      widths: {
        0: { cellWidth: 24, halign: "center" },
        3: { cellWidth: 36, halign: "center" },
        4: { cellWidth: 44, halign: "center" },
        5: { cellWidth: 40, halign: "center" },
        6: { cellWidth: 36, halign: "center" },
        7: { cellWidth: 40, halign: "center" },
        8: { cellWidth: 36, halign: "center" },
        9: { cellWidth: 36, halign: "center" },
        10: { cellWidth: 44, halign: "center" },
        11: { cellWidth: 44, halign: "center" },
        12: { cellWidth: 44, halign: "center" },
        13: { cellWidth: 48, halign: "center" },
      },
    },
  );

  y = sectionTitle(doc, y, "C", opts.mode === "management" ? "Exceptions (rollup)" : "Exceptions (detail)", chromeBase);
  if (opts.mode === "management") {
    const byKind = new Map<string, number>();
    for (const ex of model.exceptions) byKind.set(ex.kind, (byKind.get(ex.kind) ?? 0) + 1);
    const rows = [...byKind.entries()].map(([kind, count], i) => [String(i + 1), kind, String(count)]);
    const flagged = model.attendanceRows.filter(
      (e) => e.lateCount || e.overBreakCount || e.missPunchCount || e.absent || e.unpaidLeave || e.satMissCount,
    );
    y = table(doc, y, ["#", "Exception type", "Count"], rows.length ? rows : [], {
      widths: { 0: { cellWidth: 28, halign: "center" }, 2: { cellWidth: 60, halign: "center" } },
    });
    y = ensureSpace(doc, y, 20, chromeBase);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.setTextColor(...PDF_THEME.charcoal);
    doc.text("Employees with exceptions", MARGIN.left, y);
    y += 8;
    y = table(
      doc,
      y,
      ["#", "Employee", "Dept", "Late", "O.Brk", "Miss", "Absent", "Unpaid", "Sat miss"],
      flagged.map((e, i) => [
        String(i + 1),
        e.employee.name,
        e.deptName,
        warnCell(e.lateCount, e.lateCount > 0),
        warnCell(e.overBreakCount, e.overBreakCount > 0),
        warnCell(e.missPunchCount, e.missPunchCount > 0),
        warnCell(e.absent, e.absent > 0),
        warnCell(e.unpaidLeave, e.unpaidLeave > 0),
        warnCell(e.satMissCount, e.satMissCount > 0),
      ]),
    );
  } else {
    y = table(
      doc,
      y,
      ["#", "Employee", "Dept", "Date", "Exception", "Detail"],
      model.exceptions.map((ex, i) => [String(i + 1), ex.employee, ex.dept, ex.date, ex.kind, ex.detail]),
      {
        widths: {
          0: { cellWidth: 28, halign: "center" },
          3: { cellWidth: 72 },
          4: { cellWidth: 110 },
          5: { cellWidth: 70 },
        },
      },
    );
  }

  y = renderNotes(doc, y, model.notes, opts.mode, chromeBase);

  y = sectionTitle(doc, y, "E", "Performance", chromeBase);
  const perfRows = model.attendanceRows.map((e) => [
    String(e.index),
    e.employee.name,
    String(e.ratingCounts.excellent),
    String(e.ratingCounts.good),
    String(e.ratingCounts.average),
    warnCell(e.ratingCounts.needs + e.ratingCounts.poor, e.ratingCounts.needs + e.ratingCounts.poor > 0),
    warnCell(e.violationDays, e.violationDays > 0),
  ]);
  y = table(doc, y, ["#", "Employee", "Excellent", "Good", "Average", "Needs / Poor", "Violation days"], perfRows, {
    widths: {
      0: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 60, halign: "center" },
      3: { cellWidth: 50, halign: "center" },
      4: { cellWidth: 55, halign: "center" },
      5: { cellWidth: 80, halign: "center" },
      6: { cellWidth: 80, halign: "center" },
    },
  });

  if (opts.mode === "audit") {
    const pnotes = model.notes.filter((n) => n.source === "performance");
    y = ensureSpace(doc, y, 18, chromeBase);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.setTextColor(...PDF_THEME.charcoal);
    doc.text("Performance notes (detail)", MARGIN.left, y);
    y += 8;
    y = table(
      doc,
      y,
      ["#", "Employee", "Date", "Rating", "Note"],
      pnotes.map((n, i) => [String(i + 1), n.employee, n.date, n.rating ?? "—", n.text]),
      { widths: { 0: { cellWidth: 28, halign: "center" }, 2: { cellWidth: 72 }, 3: { cellWidth: 90 } } },
    );
  } else {
    const rt = o.ratingTotals;
    y = ensureSpace(doc, y, 28, chromeBase);
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    doc.setTextColor(...PDF_THEME.muted);
    doc.text(
      `Month rating totals — Excellent ${rt.excellent} · Good ${rt.good} · Average ${rt.average} · Needs ${rt.needs} · Poor ${rt.poor}`,
      MARGIN.left,
      y,
    );
    y += 14;
  }

  y = sectionTitle(doc, y, "F", "Overtime & Additional Days", chromeBase);
  if (opts.mode === "management") {
    y = table(
      doc,
      y,
      ["#", "Employee", "Dept", "Type", "OT days", "OT hours", "Add. days", "Add. hours"],
      model.otRows.map((r, i) => [
        String(i + 1),
        r.employee,
        r.dept,
        r.type,
        String(r.otDays.length),
        r.otHours,
        String(r.extraDays.length),
        r.extraHours,
      ]),
      {
        widths: {
          0: { cellWidth: 28, halign: "center" },
          4: { cellWidth: 50, halign: "center" },
          5: { cellWidth: 55, halign: "center" },
          6: { cellWidth: 55, halign: "center" },
          7: { cellWidth: 60, halign: "center" },
        },
      },
    );
  } else {
    y = table(
      doc,
      y,
      ["#", "Employee", "Dept", "Type", "Over time days", "OT hours", "Additional days", "Add. hours"],
      model.otRows.map((r, i) => [
        String(i + 1),
        r.employee,
        r.dept,
        r.type,
        r.otDays.length ? r.otDays.join("\n") : "—",
        r.otHours,
        r.extraDays.length ? r.extraDays.join("\n") : "—",
        r.extraHours,
      ]),
      {
        widths: {
          0: { cellWidth: 28, halign: "center" },
          4: { cellWidth: 130 },
          5: { cellWidth: 55, halign: "center" },
          6: { cellWidth: 130 },
          7: { cellWidth: 55, halign: "center" },
        },
      },
    );
  }

  // Closing line — avoid inventing observations
  y = ensureSpace(doc, lastY(doc) + 8, 24, chromeBase);
  doc.setFont("helvetica", "italic").setFontSize(9);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(
    "End of report — figures follow live selected-month attendance data. No bank details. No invented signatures.",
    MARGIN.left,
    y,
  );

  // Stamp chrome on every page with correct page counts
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawPageChrome(doc, { ...chromeBase, page: p, pages });
  }

  return doc;
}

export function buildMonthlyPdfDoc(
  data: Data,
  opts: Omit<MonthlyPdfOptions, "returnBytes"> & { logo?: string | null },
): { doc: jsPDF; model: MonthlyReportModel } {
  const generatedAt = opts.generatedAt ?? new Date();
  const model = buildMonthlyReportModel(data, opts.month);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  renderModel(doc, model, {
    ...opts,
    logo: opts.logo ?? null,
    generatedAt,
  });
  return { doc, model };
}

export async function downloadMonthlyPdf(data: Data, opts: MonthlyPdfOptions): Promise<Uint8Array | void> {
  const logo = opts.logoDataUrl !== undefined ? opts.logoDataUrl : await loadLogoDataUrl();
  const { doc, model } = buildMonthlyPdfDoc(data, { ...opts, logo });
  const filename = `Shaheen-${opts.mode === "management" ? "Management-Summary" : "Full-HR-Audit"}-${opts.month}.pdf`;
  if (opts.returnBytes) {
    const ab = doc.output("arraybuffer");
    return new Uint8Array(ab);
  }
  doc.save(filename);
  void model;
}

