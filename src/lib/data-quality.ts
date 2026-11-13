/**
 * Data Quality Review — findings only.
 * Never auto-merges drivers, dates, or documents. Callers must present findings
 * for human review (open section / open driver). No mutate helpers here.
 */
import {
  daysUntil,
  fmtCell,
  isOldExpiry,
  normStatus,
  parseISO,
  statusExpiryCol,
} from "./alerts";
import { SECTIONS, normName, type AppData, type Row } from "./sections";

export type DataQualitySeverity = "high" | "medium" | "low" | "info";

export type DataQualityKind =
  | "name_mismatch"
  | "possible_duplicate_name"
  | "missing_section_row"
  | "status_without_date"
  | "date_without_status"
  | "applied_past_expiry"
  | "empty_name"
  | "conflicting_status_date"
  | "unparseable_date";

export type DataQualityFinding = {
  id: string;
  kind: DataQualityKind;
  severity: DataQualitySeverity;
  title: string;
  detail: string;
  driverId: string | null;
  driverName: string;
  sectionId: string | null;
  rowId: string | null;
  /** Explicit: never auto-applied. */
  reviewOnly: true;
  suggestedReview: string;
};

export const DATA_QUALITY_POLICY =
  "Findings are reviewable only. The app never auto-merges drivers, dates, or documents.";

const WIZARD_SECTIONS = SECTIONS.filter((s) => s.inWizard).map((s) => s.id);

function cell(row: Row | undefined, i: number) {
  return (row?.cells[i] ?? "").trim();
}

function nameOf(data: AppData, driverId: string): string {
  for (const id of WIZARD_SECTIONS) {
    const r = data.sections[id]?.rows.find((x) => x.driverId === driverId);
    const n = cell(r, 0);
    if (n) return n;
  }
  return "(unnamed)";
}

function allDriverIds(data: AppData): string[] {
  const ids = new Set<string>();
  for (const id of WIZARD_SECTIONS) {
    for (const r of data.sections[id]?.rows ?? []) ids.add(r.driverId);
  }
  return [...ids];
}

/** Collect review-only data-quality findings. Temp notes are never findings. */
export function collectDataQualityFindings(data: AppData): DataQualityFinding[] {
  const out: DataQualityFinding[] = [];
  const push = (f: Omit<DataQualityFinding, "reviewOnly">) => {
    out.push({ ...f, reviewOnly: true });
  };

  // Temporary Notes are intentionally ignored — they are non-violations (never DQ findings).

  for (const driverId of allDriverIds(data)) {
    const names = new Map<string, { sectionId: string; rowId: string; name: string }>();
    for (const sectionId of WIZARD_SECTIONS) {
      const row = data.sections[sectionId]?.rows.find((r) => r.driverId === driverId);
      if (!row) {
        push({
          id: `missing_row:${driverId}:${sectionId}`,
          kind: "missing_section_row",
          severity: "medium",
          title: "Missing section row",
          detail: `Driver has no row in ${SECTIONS.find((s) => s.id === sectionId)?.title ?? sectionId}.`,
          driverId,
          driverName: nameOf(data, driverId),
          sectionId,
          rowId: null,
          suggestedReview: "Open the section and add or link the driver manually — no auto-create.",
        });
        continue;
      }
      const name = cell(row, 0);
      if (!name) {
        push({
          id: `empty_name:${sectionId}:${row.id}`,
          kind: "empty_name",
          severity: "high",
          title: "Empty driver name",
          detail: `Row in ${sectionId} has no name.`,
          driverId,
          driverName: "(empty)",
          sectionId,
          rowId: row.id,
          suggestedReview: "Open the section and enter the correct name.",
        });
      } else {
        names.set(sectionId, { sectionId, rowId: row.id, name });
      }
    }

    const uniqueNames = [...new Set([...names.values()].map((n) => normName(n.name)).filter(Boolean))];
    if (uniqueNames.length > 1) {
      const sample = [...names.values()].map((n) => `${n.sectionId}: “${n.name}”`).join("; ");
      push({
        id: `name_mismatch:${driverId}`,
        kind: "name_mismatch",
        severity: "high",
        title: "Name mismatch across sections",
        detail: sample,
        driverId,
        driverName: nameOf(data, driverId),
        sectionId: null,
        rowId: null,
        suggestedReview: "Compare sections and correct spelling manually — never auto-merge names.",
      });
    }
  }

  // Possible duplicates: same normalized name, different driverIds (review only — no linkDrivers call).
  const byName = new Map<string, { driverId: string; name: string }[]>();
  for (const driverId of allDriverIds(data)) {
    const name = nameOf(data, driverId);
    const key = normName(name);
    if (!key || key === "(unnamed)") continue;
    const list = byName.get(key) ?? [];
    if (!list.some((x) => x.driverId === driverId)) list.push({ driverId, name });
    byName.set(key, list);
  }
  for (const [key, list] of byName) {
    if (list.length < 2) continue;
    push({
      id: `dup_name:${key}`,
      kind: "possible_duplicate_name",
      severity: "medium",
      title: "Possible duplicate driver",
      detail: `Same name “${list[0].name}” appears under ${list.length} driver ids (${list.map((x) => x.driverId).join(", ")}).`,
      driverId: list[0].driverId,
      driverName: list[0].name,
      sectionId: null,
      rowId: null,
      suggestedReview: "Review Driver Cards / sections; merge only after human confirmation — no auto-merge.",
    });
  }

  /** Status→expiry pairs used for DQ (extends Applied×Expiry pairs with Medical/CDL). */
  function expiryPair(sectionId: string, statusCol: number): number | null {
    const fromAlerts = statusExpiryCol(sectionId, statusCol);
    if (fromAlerts != null) return fromAlerts;
    if (sectionId === "medical" && statusCol === 1) return 2;
    if (sectionId === "ssccdl" && statusCol === 2) return 3; // CDL only — SSC has no expiry
    return null;
  }

  // Status ↔ date consistency (DMV, Medical, Queries, SSC/CDL).
  for (const def of SECTIONS) {
    if (!["dmv", "medical", "queries", "ssccdl"].includes(def.id)) continue;
    const sec = data.sections[def.id];
    if (!sec) continue;
    for (const row of sec.rows) {
      for (let col = 0; col < def.types.length; col++) {
        if (def.types[col] !== "status") continue;
        const status = normStatus(cell(row, col));
        const expCol = expiryPair(def.id, col);
        if (expCol == null) continue; // e.g. SSC — no expiry pair
        const rawDate = cell(row, expCol);
        const header = sec.headers[col] ?? `col ${col}`;

        if ((status === "Valid" || status === "Applied") && !rawDate) {
          push({
            id: `status_nodate:${def.id}:${row.id}:${col}`,
            kind: "status_without_date",
            severity: status === "Applied" ? "medium" : "high",
            title: `${status} without expiry date`,
            detail: `${header} is ${status} but the paired expiry is empty.`,
            driverId: row.driverId,
            driverName: cell(row, 0) || nameOf(data, row.driverId),
            sectionId: def.id,
            rowId: row.id,
            suggestedReview: "Open the section and enter the correct expiry — dates are never invented.",
          });
        }

        if (rawDate && !status) {
          push({
            id: `date_nostatus:${def.id}:${row.id}:${col}`,
            kind: "date_without_status",
            severity: "medium",
            title: "Date without status",
            detail: `${sec.headers[expCol] ?? "Expiry"} is “${fmtCell(rawDate)}” but status is empty.`,
            driverId: row.driverId,
            driverName: cell(row, 0) || nameOf(data, row.driverId),
            sectionId: def.id,
            rowId: row.id,
            suggestedReview: "Set the correct status manually.",
          });
        }

        if (rawDate && !isOldExpiry(rawDate)) {
          const d = parseISO(rawDate);
          if (!d && rawDate.trim()) {
            push({
              id: `bad_date:${def.id}:${row.id}:${expCol}`,
              kind: "unparseable_date",
              severity: "medium",
              title: "Unparseable expiry date",
              detail: `Value “${rawDate}” is not YYYY-MM-DD.`,
              driverId: row.driverId,
              driverName: cell(row, 0) || nameOf(data, row.driverId),
              sectionId: def.id,
              rowId: row.id,
              suggestedReview: "Correct the date format in the section editor.",
            });
          } else if (d && status === "Valid" && daysUntil(d) < 0) {
            push({
              id: `valid_expired:${def.id}:${row.id}:${col}`,
              kind: "conflicting_status_date",
              severity: "high",
              title: "Valid status with past expiry",
              detail: `${header} is Valid but expiry ${fmtCell(rawDate)} is past.`,
              driverId: row.driverId,
              driverName: cell(row, 0) || nameOf(data, row.driverId),
              sectionId: def.id,
              rowId: row.id,
              suggestedReview: "Update status to Expired or renew the date — never auto-changed.",
            });
          } else if (d && status === "Applied" && daysUntil(d) < 0) {
            // Applied is preserved as non-auto-Valid; flag for follow-up review only.
            push({
              id: `applied_past:${def.id}:${row.id}:${col}`,
              kind: "applied_past_expiry",
              severity: "low",
              title: "Applied with past expiry (follow up)",
              detail: `${header} remains Applied while expiry ${fmtCell(rawDate)} is past. Status is not auto-changed to Valid.`,
              driverId: row.driverId,
              driverName: cell(row, 0) || nameOf(data, row.driverId),
              sectionId: def.id,
              rowId: row.id,
              suggestedReview: "Check DMV/application outcome; update status only after verification.",
            });
          }
        }
      }
    }
  }

  return out.sort((a, b) => {
    const rank: DataQualitySeverity[] = ["high", "medium", "low", "info"];
    const dr = rank.indexOf(a.severity) - rank.indexOf(b.severity);
    if (dr) return dr;
    return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" });
  });
}

export function dataQualityCounts(findings: DataQualityFinding[]) {
  return {
    all: findings.length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

/** Filter helpers for UI — never mutates AppData. */
export function filterDataQualityFindings(
  findings: DataQualityFinding[],
  opts?: { severity?: DataQualitySeverity | "all"; q?: string },
): DataQualityFinding[] {
  const severity = opts?.severity ?? "all";
  const q = (opts?.q ?? "").trim().toLowerCase();
  return findings.filter((f) => {
    if (severity !== "all" && f.severity !== severity) return false;
    if (!q) return true;
    return (
      f.driverName.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      f.detail.toLowerCase().includes(q) ||
      (f.sectionId ?? "").toLowerCase().includes(q)
    );
  });
}
