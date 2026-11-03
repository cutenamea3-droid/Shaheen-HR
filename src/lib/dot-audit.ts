import logo from "@/assets/logo.jpg.asset.json";
import { fmtCell, fmtDate, matchesExpFilter, normStatus, overallExpStatus, rowIsActive, today, type ExpFilter } from "./alerts";
import { SECTIONS, type AppData } from "./sections";

export interface DotAuditRow {
  driverId: string;
  name: string;
  cdl: string;
  dmvStatus: string;
  medicalExpiry: string;
  clearinghouseAnnual: string;
  overall: string;
}

const HEAD = ["Driver Name", "CDL Number", "DMV Status", "Medical Card Expiry", "Clearinghouse Annual Date", "Overall Status"] as const;

/** One audit row per driver (active by default; pass filter to limit). */
export function buildDotAuditRows(data: AppData, opts?: { activeOnly?: boolean; expFilter?: ExpFilter }): DotAuditRow[] {
  const activeOnly = opts?.activeOnly !== false;
  const expFilter = opts?.expFilter ?? "all";
  const map = new Map<string, DotAuditRow>();

  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    const sec = data.sections[def.id];
    for (const r of sec.rows) {
      if (activeOnly && !rowIsActive(def, r, data)) continue;
      let row = map.get(r.driverId);
      if (!row) {
        row = {
          driverId: r.driverId,
          name: (r.cells[0] ?? "").trim(),
          cdl: "",
          dmvStatus: "",
          medicalExpiry: "",
          clearinghouseAnnual: "",
          overall: "",
        };
        map.set(r.driverId, row);
      }
      if (!row.name.trim()) row.name = (r.cells[0] ?? "").trim();
      if (def.id === "dmv") {
        row.dmvStatus = normStatus(r.cells[2] ?? "") || (r.cells[2] ?? "").trim() || "—";
        if (!row.cdl) row.cdl = (r.cells[1] ?? "").trim();
      }
      if (def.id === "ssccdl" && (r.cells[1] ?? "").trim()) row.cdl = (r.cells[1] ?? "").trim();
      if (def.id === "medical") row.medicalExpiry = fmtCell(r.cells[2] ?? "") || "—";
      if (def.id === "queries") row.clearinghouseAnnual = fmtCell(r.cells[2] ?? "") || "—";
    }
  }

  return [...map.values()]
    .filter((r) => matchesExpFilter(data, r.driverId, expFilter))
    .map((r) => ({
      ...r,
      cdl: r.cdl || "—",
      dmvStatus: r.dmvStatus || "—",
      medicalExpiry: r.medicalExpiry || "—",
      clearinghouseAnnual: r.clearinghouseAnnual || "—",
      overall: overallExpStatus(data, r.driverId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function csvEscape(v: string) {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadDotAuditCsv(rows: DotAuditRow[]) {
  const lines = [
    HEAD.join(","),
    ...rows.map((r) =>
      [r.name, r.cdl, r.dmvStatus, r.medicalExpiry, r.clearinghouseAnnual, r.overall].map(csvEscape).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shaheen-dot-audit-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/** Printable table with Shaheen Transport LLC logo + current date header. */
export function printDotAuditSummary(rows: DotAuditRow[]) {
  const dateStr = fmtDate(today());
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.cdl)}</td>
        <td>${esc(r.dmvStatus)}</td>
        <td>${esc(r.medicalExpiry)}</td>
        <td>${esc(r.clearinghouseAnnual)}</td>
        <td class="${statusClass(r.overall)}">${esc(r.overall)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="text-align:center;padding:24px">No drivers match.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>DOT Audit Summary — Shaheen Transport LLC</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; color: #1a1208; background: #fff; }
  .dot-audit-print { padding: 24px 32px; }
  .dot-audit-header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #d9711f; padding-bottom: 16px; margin-bottom: 20px; }
  .dot-audit-header img { width: 64px; height: 64px; object-fit: contain; border-radius: 10px; }
  .dot-audit-header h1 { margin: 0; font-size: 22px; letter-spacing: 0.02em; }
  .dot-audit-header p { margin: 4px 0 0; font-size: 13px; color: #5a4a38; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #c9b8a4; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #342818; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr:nth-child(even) td { background: #fdf6ec; }
  .st-expired { color: #b42318; font-weight: 700; }
  .st-soon { color: #b54708; font-weight: 700; }
  .st-ok { color: #067647; font-weight: 700; }
  .dot-audit-actions { margin-bottom: 16px; display: flex; gap: 8px; }
  .dot-audit-actions button { font: inherit; font-weight: 700; padding: 8px 14px; border-radius: 8px; border: 2px solid #342818; background: #d9711f; color: #fff; cursor: pointer; }
  .dot-audit-actions button.secondary { background: #fff; color: #342818; }
  @media print {
    .dot-audit-actions { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dot-audit-print { padding: 0; }
  }
</style>
</head>
<body>
  <div class="dot-audit-print">
    <div class="dot-audit-actions">
      <button type="button" onclick="window.print()">Print</button>
      <button type="button" class="secondary" onclick="window.close()">Close</button>
    </div>
    <header class="dot-audit-header">
      <img src="${esc(logo.url)}" alt="Shaheen Transport LLC logo"/>
      <div>
        <h1>Shaheen Transport LLC — DOT Audit Summary</h1>
        <p>Generated ${esc(dateStr)} · ${rows.length} driver${rows.length === 1 ? "" : "s"}</p>
      </div>
    </header>
    <table>
      <thead><tr>${HEAD.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function statusClass(overall: string) {
  if (overall === "Expired") return "st-expired";
  if (overall === "Expiring Soon") return "st-soon";
  return "st-ok";
}

/** CSV download + printable window together. */
export function exportDotAuditSummary(data: AppData) {
  const rows = buildDotAuditRows(data);
  downloadDotAuditCsv(rows);
  printDotAuditSummary(rows);
}
