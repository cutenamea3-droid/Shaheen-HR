import logo from "@/assets/logo.jpg.asset.json";
import {
  appliedExpiryView,
  complianceScore,
  fmtCell,
  fmtDate,
  normStatus,
  statusExpiryCol,
  today,
} from "./alerts";
import { driverEmploymentStatus, normName, type AppData } from "./sections";

export interface DossierLine {
  label: string;
  status: string;
  expiry: string;
  notes: string;
  /** Optional group heading for print layout (e.g. Clearinghouse, Other Docs). */
  section?: string;
}

export interface DossierRecordLine {
  source: string;
  document: string;
  status: string;
  expiry: string;
  notes: string;
}

export interface DriverDossier {
  driverId: string;
  name: string;
  cdl: string;
  employment: string;
  phone: string;
  email: string;
  state: string;
  lines: DossierLine[];
  otherDocs: DossierLine[];
  records: DossierRecordLine[];
}

function cell(row: { cells: string[] } | undefined, i: number) {
  return (row?.cells[i] ?? "").trim();
}

function statusOf(row: { cells: string[] } | undefined, i: number) {
  const raw = cell(row, i);
  return normStatus(raw) || raw || "—";
}

/** Status cell with Applied × Expiration enrichment when a paired expiry exists. */
function statusDisplay(sectionId: string, statusCol: number, row: { cells: string[] } | undefined): string {
  const raw = cell(row, statusCol);
  const normalized = normStatus(raw);
  if (!normalized && !raw) return "—";
  if (normalized !== "Applied") return normalized || raw;
  const expCol = statusExpiryCol(sectionId, statusCol);
  if (expCol == null) return "Applied";
  return appliedExpiryView(cell(row, expCol))?.label ?? "Applied";
}

function onlyThisDriver<T extends { driverId: string }>(rows: T[] | undefined, driverId: string): T | undefined {
  return rows?.find((r) => r.driverId === driverId);
}

const DEFAULT_DOC_HEADERS = [
  "Annual Query Consent Form",
  "Drug & Alcohol Consent Form",
  "Employment Application",
  "Company Policy",
  "Drug & Alcohol Policy",
  "Statement of On-Duty Hours",
  "Pre-Employment Drug Test",
  "Chain of Custody",
  "DMV Printout",
  "Road Test",
  "I-9",
  "W-4",
];

const RECORD_TABS = [
  { id: "rec_drivers", label: "Driver Extra Documents" },
  { id: "rec_owners", label: "Owner Operators" },
  { id: "rec_mechanics", label: "Mechanics" },
] as const;

function buildOtherDocs(data: AppData, driverId: string): DossierLine[] {
  const docs = onlyThisDriver(data.sections.docs?.rows, driverId);
  if (!docs) return [];
  const headers = data.sections.docs?.headers ?? [];
  const lines: DossierLine[] = [];
  for (let i = 2; i <= 13; i++) {
    const label = (headers[i] ?? DEFAULT_DOC_HEADERS[i - 2] ?? `Document ${i - 1}`).trim() || `Document ${i - 1}`;
    const status = statusOf(docs, i);
    if (status === "—") continue;
    lines.push({
      section: "Other Docs",
      label,
      status,
      expiry: "—",
      notes: "—",
    });
  }
  return lines;
}

/** Extra Records rows whose Name matches this driver only (never another driver). */
function buildRelevantRecords(data: AppData, driverName: string): DossierRecordLine[] {
  const key = normName(driverName);
  if (!key) return [];
  const out: DossierRecordLine[] = [];
  for (const tab of RECORD_TABS) {
    const rows = data.sections[tab.id]?.rows ?? [];
    for (const row of rows) {
      if (normName(row.cells[0] ?? "") !== key) continue;
      out.push({
        source: tab.label,
        document: cell(row, 1) || "—",
        status: statusOf(row, 2),
        expiry: fmtCell(cell(row, 3)) || "—",
        notes: cell(row, 4) || "—",
      });
    }
  }
  return out;
}

/** Compliance snapshot for one driver (print dossier). Scoped strictly by driverId. */
export function buildDriverDossier(data: AppData, driverId: string): DriverDossier {
  const dmv = onlyThisDriver(data.sections.dmv?.rows, driverId);
  const medical = onlyThisDriver(data.sections.medical?.rows, driverId);
  const queries = onlyThisDriver(data.sections.queries?.rows, driverId);
  const ssccdl = onlyThisDriver(data.sections.ssccdl?.rows, driverId);
  const docs = onlyThisDriver(data.sections.docs?.rows, driverId);
  const info = onlyThisDriver(data.sections.info?.rows, driverId);

  const name =
    cell(dmv, 0) ||
    cell(ssccdl, 0) ||
    cell(medical, 0) ||
    cell(queries, 0) ||
    cell(docs, 0) ||
    cell(info, 0) ||
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
      section: "DMV",
      label: "DMV Pull Notice",
      status: statusDisplay("dmv", 2, dmv),
      expiry: fmtCell(cell(dmv, 3)) || "—",
      notes: [cell(dmv, 4) ? `Report: ${cell(dmv, 4)}` : "", cell(dmv, 5)].filter(Boolean).join(" · ") || "—",
    },
    {
      section: "Medical",
      label: "Medical Certificate",
      status: statusOf(medical, 1),
      expiry: fmtCell(cell(medical, 2)) || "—",
      notes: cell(medical, 3) || "—",
    },
    {
      section: "Clearinghouse",
      label: "Pre-Employment Query",
      status: statusDisplay("queries", 3, queries),
      expiry: fmtCell(cell(queries, 4)) || "—",
      notes: cell(queries, 5) || "—",
    },
    {
      section: "Clearinghouse",
      label: "Annual Query",
      status: statusDisplay("queries", 1, queries),
      expiry: fmtCell(cell(queries, 2)) || "—",
      notes: cell(queries, 5) || "—",
    },
    {
      section: "SSC / CDL",
      label: "CDL",
      status: statusOf(ssccdl, 2),
      expiry: fmtCell(cell(ssccdl, 3)) || "—",
      notes: cell(ssccdl, 6) || "—",
    },
    {
      section: "SSC / CDL",
      label: "Social Security Card",
      status: statusOf(ssccdl, 4),
      expiry: "—",
      notes: cell(ssccdl, 6) || "—",
    },
    {
      section: "Other Docs",
      label: "Other Documents (summary)",
      status: docsStatus,
      expiry: "—",
      notes: docsNotes || "—",
    },
  ];

  return {
    driverId,
    name,
    cdl,
    employment: driverEmploymentStatus(data, driverId),
    phone: cell(info, 1) || "—",
    email: cell(info, 2) || "—",
    state: cell(info, 3) || cell(dmv, 8) || "—",
    lines,
    otherDocs: buildOtherDocs(data, driverId),
    records: buildRelevantRecords(data, name),
  };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function logoAbsoluteUrl(): string {
  try {
    const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost";
    return new URL(logo.url, base).href;
  } catch {
    return logo.url;
  }
}

function tableRows(
  lines: Array<{ label: string; status: string; expiry: string; notes: string; section?: string }>,
  opts?: { showSection?: boolean },
): string {
  let lastSection = "";
  return lines
    .map((r) => {
      const section = (r.section ?? "").trim();
      const showBanner = !!opts?.showSection && section && section !== lastSection;
      if (showBanner) lastSection = section;
      const banner = showBanner
        ? `<tr class="section-banner"><td colspan="4"><strong>${esc(section)}</strong></td></tr>`
        : "";
      return `${banner}<tr>
      <td><strong>${esc(r.label)}</strong></td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.expiry)}</td>
      <td>${esc(r.notes || "—")}</td>
    </tr>`;
    })
    .join("");
}

/** Build printable HTML for one driver dossier (no side effects). */
export function renderDriverDossierHtml(data: AppData, driverId: string, opts?: { logoUrl?: string }): string {
  const dossier = buildDriverDossier(data, driverId);
  const { name, cdl, lines, otherDocs, records, employment, phone, email, state } = dossier;
  const dateStr = fmtDate(today());
  const logoSrc = esc(opts?.logoUrl ?? logoAbsoluteUrl());

  const complianceBody = tableRows(lines, { showSection: true });
  const otherBody = otherDocs.length
    ? tableRows(otherDocs)
    : `<tr><td colspan="4" class="empty">No other documents on file for this driver.</td></tr>`;
  const recordsBody = records.length
    ? records
        .map(
          (r) => `<tr>
      <td><strong>${esc(r.source)}</strong><br/><span class="muted">${esc(r.document)}</span></td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.expiry)}</td>
      <td>${esc(r.notes || "—")}</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No matching extra records for this driver.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Driver Dossier — ${esc(name)} — Shaheen Transport LLC</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #1a1208;
    background: #fff;
    line-height: 1.45;
  }
  .dossier-print { padding: 20px 28px 32px; max-width: 900px; margin: 0 auto; }
  .dossier-header {
    display: flex; align-items: center; gap: 16px;
    border-bottom: 3px solid #d9711f; padding-bottom: 14px; margin-bottom: 16px;
  }
  .dossier-header img { width: 72px; height: 72px; object-fit: contain; border-radius: 10px; }
  .dossier-header h1 { margin: 0; font-size: 22px; letter-spacing: 0.02em; color: #342818; }
  .dossier-header p { margin: 4px 0 0; font-size: 13px; color: #5a4a38; }
  .dossier-meta {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px;
    margin: 0 0 18px; font-size: 13px; padding: 12px 14px;
    background: #fdf6ec; border: 1px solid #e4d3bf; border-radius: 8px;
  }
  .dossier-meta strong { font-weight: 700; color: #342818; }
  .dossier-section { margin: 0 0 18px; break-inside: avoid; page-break-inside: avoid; }
  .dossier-section h2 {
    margin: 0 0 8px; font-size: 14px; letter-spacing: 0.06em;
    text-transform: uppercase; color: #342818; border-bottom: 1px solid #c9b8a4; padding-bottom: 4px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #c9b8a4; padding: 8px 10px; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #342818; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr:nth-child(even) td { background: #fdf6ec; }
  tr.section-banner td {
    background: #efe4d4 !important; color: #342818; font-size: 11px;
    letter-spacing: 0.05em; text-transform: uppercase; border-top: 2px solid #d9711f;
  }
  td.empty { text-align: center; color: #5a4a38; font-style: italic; }
  .muted { color: #5a4a38; font-size: 11px; }
  .dossier-footer {
    margin-top: 20px; padding-top: 10px; border-top: 1px solid #c9b8a4;
    font-size: 11px; color: #5a4a38;
  }
  .dossier-actions { margin-bottom: 16px; display: flex; gap: 8px; }
  .dossier-actions button {
    font: inherit; font-weight: 700; padding: 8px 14px; border-radius: 8px;
    border: 2px solid #342818; background: #d9711f; color: #fff; cursor: pointer;
  }
  .dossier-actions button.secondary { background: #fff; color: #342818; }
  @page { size: auto; margin: 12mm; }
  @media print {
    .dossier-actions, .tracker-no-print, .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
    .dossier-print { padding: 0; max-width: none; }
    .dossier-section, tr, .dossier-header, .dossier-meta {
      break-inside: avoid; page-break-inside: avoid;
    }
    thead { display: table-header-group; }
    h2 { break-after: avoid; page-break-after: avoid; }
  }
</style>
</head>
<body>
  <div class="dossier-print" data-driver-id="${esc(driverId)}">
    <div class="dossier-actions tracker-no-print no-print">
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
      <button type="button" class="secondary" onclick="window.close()">Close</button>
    </div>
    <header class="dossier-header">
      <img src="${logoSrc}" alt="Shaheen Transport LLC logo"/>
      <div>
        <h1>Shaheen Transport LLC — Driver Dossier</h1>
        <p>Compliance file · Printed ${esc(dateStr)}</p>
      </div>
    </header>
    <div class="dossier-meta">
      <div><strong>Driver:</strong> ${esc(name)}</div>
      <div><strong>CDL / License:</strong> ${esc(cdl)}</div>
      <div><strong>Employment:</strong> ${esc(employment)}</div>
      <div><strong>State:</strong> ${esc(state)}</div>
      <div><strong>Phone:</strong> ${esc(phone)}</div>
      <div><strong>Email:</strong> ${esc(email)}</div>
      <div><strong>Printed:</strong> ${esc(dateStr)}</div>
      <div><strong>Driver ID:</strong> ${esc(driverId)}</div>
    </div>
    <section class="dossier-section">
      <h2>Compliance overview</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>Expiration</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${complianceBody}</tbody>
      </table>
    </section>
    <section class="dossier-section">
      <h2>Other documents</h2>
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Status</th>
            <th>Expiration</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${otherBody}</tbody>
      </table>
    </section>
    <section class="dossier-section">
      <h2>Relevant records</h2>
      <table>
        <thead>
          <tr>
            <th>Source / Document</th>
            <th>Status</th>
            <th>Expiration</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${recordsBody}</tbody>
      </table>
    </section>
    <p class="dossier-footer">Shaheen Transport LLC · Confidential driver compliance dossier · ${esc(name)} only</p>
  </div>
  <script>
    (function () {
      function go() {
        try { window.focus(); } catch (e) {}
        window.print();
      }
      function schedule() { setTimeout(go, 200); }
      if (document.readyState === "complete") schedule();
      else window.addEventListener("load", schedule);
    })();
  </script>
</body>
</html>`;
}

function printViaIframe(html: string): boolean {
  if (typeof document === "undefined") return false;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Driver dossier print");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  // Cleanup after print dialog settles (best-effort).
  setTimeout(() => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  }, 60_000);
  return true;
}

/**
 * Open a printable driver dossier and trigger the browser print dialog.
 * Avoids `noopener` on window.open (which returns null and blocks writing).
 * Falls back to a hidden iframe when pop-ups are blocked.
 */
export function printDriverDossier(data: AppData, driverId: string): boolean {
  if (!driverId) return false;
  const html = renderDriverDossierHtml(data, driverId);

  // Do NOT pass "noopener" — modern browsers then return null and the write never runs.
  const w = typeof window !== "undefined" ? window.open("", "_blank", "width=920,height=820") : null;
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* ignore */
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  }

  return printViaIframe(html);
}
