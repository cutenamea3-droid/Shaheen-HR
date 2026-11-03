import logo from "@/assets/logo.jpg.asset.json";
import { complianceScore, fmtCell, fmtDate, normStatus, today } from "./alerts";
import type { AppData } from "./sections";

export interface DossierLine {
  label: string;
  status: string;
  expiry: string;
  notes: string;
}

function cell(row: { cells: string[] } | undefined, i: number) {
  return (row?.cells[i] ?? "").trim();
}

function statusOf(row: { cells: string[] } | undefined, i: number) {
  const raw = cell(row, i);
  return normStatus(raw) || raw || "—";
}

/** Six-row compliance snapshot for one driver (print dossier). */
export function buildDriverDossier(data: AppData, driverId: string): {
  name: string;
  cdl: string;
  lines: DossierLine[];
} {
  const dmv = data.sections.dmv?.rows.find((r) => r.driverId === driverId);
  const medical = data.sections.medical?.rows.find((r) => r.driverId === driverId);
  const queries = data.sections.queries?.rows.find((r) => r.driverId === driverId);
  const ssccdl = data.sections.ssccdl?.rows.find((r) => r.driverId === driverId);
  const docs = data.sections.docs?.rows.find((r) => r.driverId === driverId);

  const name =
    cell(dmv, 0) ||
    cell(ssccdl, 0) ||
    cell(medical, 0) ||
    cell(queries, 0) ||
    cell(docs, 0) ||
    "—";
  const cdl = cell(ssccdl, 1) || cell(dmv, 1) || "—";

  let docsStatus = "—";
  let docsNotes = "";
  if (docs) {
    let valid = 0;
    for (let i = 2; i <= 13; i++) if (normStatus(docs.cells[i] ?? "") === "Valid") valid++;
    docsStatus = `${complianceScore(docs)}% · ${valid}/12 valid`;
    docsNotes = cell(docs, 14);
  }

  const lines: DossierLine[] = [
    {
      label: "DMV",
      status: statusOf(dmv, 2),
      expiry: fmtCell(cell(dmv, 3)) || "—",
      notes: cell(dmv, 5),
    },
    {
      label: "Medical",
      status: statusOf(medical, 1),
      expiry: fmtCell(cell(medical, 2)) || "—",
      notes: cell(medical, 3),
    },
    {
      label: "Pre-Employment Query",
      status: statusOf(queries, 3),
      expiry: fmtCell(cell(queries, 4)) || "—",
      notes: cell(queries, 5),
    },
    {
      label: "Annual Query",
      status: statusOf(queries, 1),
      expiry: fmtCell(cell(queries, 2)) || "—",
      notes: cell(queries, 5),
    },
    {
      label: "SSC & CDL",
      status: `CDL ${statusOf(ssccdl, 2)} · SSC ${statusOf(ssccdl, 4)}`,
      expiry: fmtCell(cell(ssccdl, 3)) || "—",
      notes: cell(ssccdl, 6),
    },
    {
      label: "Extra Docs",
      status: docsStatus,
      expiry: "—",
      notes: docsNotes,
    },
  ];

  return { name, cdl, lines };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Open a printable driver dossier window (logo, name/CDL/date, 6-row table). */
export function printDriverDossier(data: AppData, driverId: string) {
  const { name, cdl, lines } = buildDriverDossier(data, driverId);
  const dateStr = fmtDate(today());
  const body = lines
    .map(
      (r) => `<tr>
      <td><strong>${esc(r.label)}</strong></td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.expiry)}</td>
      <td>${esc(r.notes || "—")}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Driver Dossier — ${esc(name)} — Shaheen Transport LLC</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; margin: 0; color: #1a1208; background: #fff; }
  .dossier-print { padding: 24px 32px; }
  .dossier-header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #d9711f; padding-bottom: 16px; margin-bottom: 20px; }
  .dossier-header img { width: 64px; height: 64px; object-fit: contain; border-radius: 10px; }
  .dossier-header h1 { margin: 0; font-size: 22px; letter-spacing: 0.02em; }
  .dossier-header p { margin: 4px 0 0; font-size: 13px; color: #5a4a38; }
  .dossier-meta { margin: 0 0 18px; font-size: 14px; }
  .dossier-meta strong { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #c9b8a4; padding: 10px 12px; text-align: left; vertical-align: top; }
  th { background: #342818; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr:nth-child(even) td { background: #fdf6ec; }
  .dossier-actions { margin-bottom: 16px; display: flex; gap: 8px; }
  .dossier-actions button { font: inherit; font-weight: 700; padding: 8px 14px; border-radius: 8px; border: 2px solid #342818; background: #d9711f; color: #fff; cursor: pointer; }
  .dossier-actions button.secondary { background: #fff; color: #342818; }
  @media print {
    .dossier-actions, .tracker-no-print, .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dossier-print { padding: 0; }
  }
</style>
</head>
<body>
  <div class="dossier-print">
    <div class="dossier-actions tracker-no-print no-print">
      <button type="button" onclick="window.print()">Print</button>
      <button type="button" class="secondary" onclick="window.close()">Close</button>
    </div>
    <header class="dossier-header">
      <img src="${esc(logo.url)}" alt="Shaheen Transport LLC logo"/>
      <div>
        <h1>Shaheen Transport LLC — Driver Dossier</h1>
        <p>Printed ${esc(dateStr)}</p>
      </div>
    </header>
    <p class="dossier-meta">
      <strong>Driver:</strong> ${esc(name)}
      &nbsp;·&nbsp;
      <strong>CDL:</strong> ${esc(cdl)}
      &nbsp;·&nbsp;
      <strong>Date:</strong> ${esc(dateStr)}
    </p>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Status</th>
          <th>Expiration</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=800");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
