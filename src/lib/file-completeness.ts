/**
 * File Completeness — per-driver + fleet %, with an explained formula.
 * Builds on inspection-readiness statuses. Temp notes / Future Plans are not scored.
 * DMV Applied counts as pending (not complete). No auto-merge of missing docs.
 */
import logo from "@/assets/logo.jpg.asset.json";
import { downloadReportPdf } from "./pdf";
import { fmtDate, today } from "./alerts";
import {
  buildInspectionItems,
  buildInspectionSummaries,
  type InspectionDriverSummary,
  type InspectionStatus,
} from "./inspection-readiness";
import type { AppData } from "./sections";

/** Statuses that count toward the completeness numerator. */
export const COMPLETE_STATUSES: InspectionStatus[] = ["verified", "present"];

/** Statuses that are in the denominator (applicable). N/A excluded. */
export const APPLICABLE_EXCLUDE: InspectionStatus[] = ["n_a"];

export const FILE_COMPLETENESS_FORMULA = [
  "File Completeness % = (Verified + Present) ÷ (all checklist items except N/A) × 100.",
  "Verified = Valid with a parseable future expiry (or Valid with no expiry required, e.g. SSC / Other Docs).",
  "Present = recorded non-standard status that is not Missing/Invalid/Expired/Applied.",
  "Pending (Applied), Missing, Expired, and Unable to verify do not count as complete.",
  "Temporary Notes and Future Plans are never part of this score.",
  "N/A items are excluded from both numerator and denominator.",
  "Percentages are rounded to the nearest integer. Nothing is auto-merged or auto-filled.",
].join(" ");

export type FileCompletenessRow = {
  driverId: string;
  driverName: string;
  complete: number;
  applicable: number;
  percent: number;
  verified: number;
  present: number;
  missing: number;
  expired: number;
  pending: number;
  unable: number;
  n_a: number;
  formulaNote: string;
};

export type FileCompletenessReport = {
  generatedAt: string;
  formula: string;
  fleetPercent: number;
  fleetComplete: number;
  fleetApplicable: number;
  drivers: FileCompletenessRow[];
};

function scoreItems(summary: InspectionDriverSummary): FileCompletenessRow {
  let complete = 0;
  let applicable = 0;
  const c = summary.counts;
  for (const status of Object.keys(c) as InspectionStatus[]) {
    const n = c[status];
    if (APPLICABLE_EXCLUDE.includes(status)) continue;
    applicable += n;
    if (COMPLETE_STATUSES.includes(status)) complete += n;
  }
  const percent = applicable === 0 ? 100 : Math.round((complete / applicable) * 100);
  return {
    driverId: summary.driverId,
    driverName: summary.driverName,
    complete,
    applicable,
    percent,
    verified: c.verified,
    present: c.present,
    missing: c.missing,
    expired: c.expired,
    pending: c.pending,
    unable: c.unable,
    n_a: c.n_a,
    formulaNote: `${complete}/${applicable} = ${percent}% (excl. N/A)`,
  };
}

export function buildFileCompletenessReport(data: AppData): FileCompletenessReport {
  const summaries = buildInspectionSummaries(data);
  const drivers = summaries.map(scoreItems).sort((a, b) => {
    if (a.percent !== b.percent) return a.percent - b.percent;
    return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" });
  });

  let fleetComplete = 0;
  let fleetApplicable = 0;
  for (const d of drivers) {
    fleetComplete += d.complete;
    fleetApplicable += d.applicable;
  }
  const fleetPercent =
    fleetApplicable === 0 ? 100 : Math.round((fleetComplete / fleetApplicable) * 100);

  return {
    generatedAt: fmtDate(today()),
    formula: FILE_COMPLETENESS_FORMULA,
    fleetPercent,
    fleetComplete,
    fleetApplicable,
    drivers,
  };
}

/** Per-driver percent using the same formula (for deep links / cards). */
export function driverFileCompletenessPercent(data: AppData, driverId: string): number {
  const items = buildInspectionItems(data, driverId);
  let complete = 0;
  let applicable = 0;
  for (const it of items) {
    if (APPLICABLE_EXCLUDE.includes(it.status)) continue;
    applicable++;
    if (COMPLETE_STATUSES.includes(it.status)) complete++;
  }
  return applicable === 0 ? 100 : Math.round((complete / applicable) * 100);
}

function csvEscape(v: string) {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function fileCompletenessCsv(report: FileCompletenessReport): string {
  const head = [
    "Driver Name",
    "Driver ID",
    "Completeness %",
    "Complete",
    "Applicable",
    "Verified",
    "Present",
    "Missing",
    "Expired",
    "Pending",
    "Unable",
    "N/A",
    "Formula note",
  ];
  const lines = [
    `# File Completeness — Shaheen Transport LLC`,
    `# Generated ${report.generatedAt}`,
    `# Fleet ${report.fleetPercent}% (${report.fleetComplete}/${report.fleetApplicable})`,
    `# Formula: ${report.formula}`,
    head.join(","),
    ...report.drivers.map((d) =>
      [
        d.driverName,
        d.driverId,
        String(d.percent),
        String(d.complete),
        String(d.applicable),
        String(d.verified),
        String(d.present),
        String(d.missing),
        String(d.expired),
        String(d.pending),
        String(d.unable),
        String(d.n_a),
        d.formulaNote,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function downloadFileCompletenessCsv(report: FileCompletenessReport) {
  const blob = new Blob([fileCompletenessCsv(report)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shaheen-file-completeness-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

export function downloadFileCompletenessPdf(report: FileCompletenessReport) {
  const head = ["Driver", "%", "Complete", "Applicable", "Missing", "Expired", "Pending", "Unable", "Note"];
  const body = report.drivers.map((d) => [
    d.driverName,
    `${d.percent}%`,
    String(d.complete),
    String(d.applicable),
    String(d.missing),
    String(d.expired),
    String(d.pending),
    String(d.unable),
    d.formulaNote,
  ]);
  downloadReportPdf(
    "File Completeness",
    `Fleet ${report.fleetPercent}% (${report.fleetComplete}/${report.fleetApplicable})`,
    head,
    body,
  );
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Printable HTML with formula explanation (complements PDF). */
export function printFileCompletenessSummary(report: FileCompletenessReport) {
  const rows = report.drivers.length
    ? report.drivers
        .map(
          (d) => `<tr>
      <td>${esc(d.driverName)}</td>
      <td class="pct">${d.percent}%</td>
      <td>${d.complete}/${d.applicable}</td>
      <td>${d.missing}</td>
      <td>${d.expired}</td>
      <td>${d.pending}</td>
      <td>${d.unable}</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;padding:24px">No active drivers.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>File Completeness — Shaheen Transport LLC</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; color: #1a1208; }
  .wrap { padding: 24px 32px; }
  header { display: flex; gap: 16px; align-items: center; border-bottom: 3px solid #d9711f; padding-bottom: 16px; margin-bottom: 16px; }
  header img { width: 64px; height: 64px; object-fit: contain; border-radius: 10px; }
  h1 { margin: 0; font-size: 22px; }
  .formula { background: #fdf6ec; border: 1px solid #c9b8a4; padding: 12px 14px; font-size: 13px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #c9b8a4; padding: 8px 10px; text-align: left; }
  th { background: #342818; color: #fff; }
  .pct { font-weight: 700; }
  .actions { margin-bottom: 12px; }
  .actions button { font: inherit; font-weight: 700; padding: 8px 14px; border-radius: 8px; border: 2px solid #342818; background: #d9711f; color: #fff; cursor: pointer; }
  @media print { .actions { display: none !important; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="actions"><button type="button" onclick="window.print()">Print</button></div>
    <header>
      <img src="${esc(logo.url)}" alt="Shaheen Transport LLC logo"/>
      <div>
        <h1>Shaheen Transport LLC — File Completeness</h1>
        <p>Generated ${esc(report.generatedAt)} · Fleet ${report.fleetPercent}% (${report.fleetComplete}/${report.fleetApplicable})</p>
      </div>
    </header>
    <div class="formula"><strong>How % is calculated:</strong> ${esc(report.formula)}</div>
    <table>
      <thead><tr>
        <th>Driver</th><th>%</th><th>Complete / Applicable</th>
        <th>Missing</th><th>Expired</th><th>Pending</th><th>Unable</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function exportFileCompleteness(data: AppData) {
  const report = buildFileCompletenessReport(data);
  downloadFileCompletenessCsv(report);
  downloadFileCompletenessPdf(report);
  return report;
}
