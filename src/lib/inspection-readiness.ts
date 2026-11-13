/**
 * Inspection Readiness — honest per-document statuses.
 * Status vocabulary is fixed; never invent "verified" without evidence.
 * Temporary Notes and Future Plans are never readiness violations.
 * DMV Applied → pending (not auto-Valid).
 */
import {
  daysUntil,
  fmtCell,
  isOldExpiry,
  normStatus,
  parseISO,
  rowIsActive,
  statusExpiryCol,
} from "./alerts";
import { SECTIONS, type AppData, type Row } from "./sections";
import { isOwnerOperator } from "./driver-meta";

/** Honest inspection status — only these values. */
export type InspectionStatus =
  | "verified"
  | "present"
  | "missing"
  | "expired"
  | "pending"
  | "n_a"
  | "unable";

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  verified: "Verified",
  present: "Present",
  missing: "Missing",
  expired: "Expired",
  pending: "Pending",
  n_a: "N/A",
  unable: "Unable to verify",
};

export type InspectionItem = {
  key: string;
  driverId: string;
  driverName: string;
  category: string;
  document: string;
  sectionId: string;
  rowId: string | null;
  status: InspectionStatus;
  evidence: string;
  expiryDisplay: string;
};

export type InspectionDriverSummary = {
  driverId: string;
  driverName: string;
  items: InspectionItem[];
  counts: Record<InspectionStatus, number>;
  /** Worst actionable status for sorting (expired > missing > pending > unable > present > verified > n_a). */
  worst: InspectionStatus;
};

const WORST_RANK: InspectionStatus[] = [
  "expired",
  "missing",
  "pending",
  "unable",
  "present",
  "verified",
  "n_a",
];

function worse(a: InspectionStatus, b: InspectionStatus): InspectionStatus {
  return WORST_RANK.indexOf(a) <= WORST_RANK.indexOf(b) ? a : b;
}

function emptyCounts(): Record<InspectionStatus, number> {
  return {
    verified: 0,
    present: 0,
    missing: 0,
    expired: 0,
    pending: 0,
    n_a: 0,
    unable: 0,
  };
}

function cell(row: Row | undefined, i: number) {
  return (row?.cells[i] ?? "").trim();
}

function rowFor(data: AppData, sectionId: string, driverId: string): Row | undefined {
  return data.sections[sectionId]?.rows.find((r) => r.driverId === driverId);
}

function driverName(data: AppData, driverId: string): string {
  for (const id of ["dmv", "ssccdl", "medical", "queries", "docs", "info"]) {
    const n = cell(rowFor(data, id, driverId), 0);
    if (n) return n;
  }
  return "(unnamed)";
}

/**
 * Map a status cell + optional expiry into an honest InspectionStatus.
 * Applied → pending (preserved; never auto-Valid).
 * Temp notes / Future Plans are not inputs here.
 */
export function statusFromCell(opts: {
  statusRaw: string;
  expiryRaw?: string;
  /** When true, no expiry is required for "verified" (e.g. SSC, Other Docs). */
  noExpiryRequired?: boolean;
}): { status: InspectionStatus; evidence: string; expiryDisplay: string } {
  const status = normStatus(opts.statusRaw);
  const expiryRaw = (opts.expiryRaw ?? "").trim();
  const expiryDisplay = expiryRaw ? (isOldExpiry(expiryRaw) ? expiryRaw : fmtCell(expiryRaw) || expiryRaw) : "—";

  if (!status && !expiryRaw) {
    return { status: "missing", evidence: "No status and no date on file", expiryDisplay };
  }
  if (!status && expiryRaw) {
    return {
      status: "unable",
      evidence: `Date present (${expiryDisplay}) but status empty — cannot verify`,
      expiryDisplay,
    };
  }

  if (status === "Missing" || status === "Invalid" || status === "Sign Missing") {
    return {
      status: "missing",
      evidence: `Recorded as ${status}`,
      expiryDisplay,
    };
  }

  if (status === "Expired") {
    return { status: "expired", evidence: "Status is Expired", expiryDisplay };
  }

  if (status === "Applied") {
    return {
      status: "pending",
      evidence: "Applied — awaiting outcome (not auto-marked Valid)",
      expiryDisplay,
    };
  }

  if (status === "Valid") {
    if (opts.noExpiryRequired) {
      return { status: "verified", evidence: "Status Valid (no expiry required)", expiryDisplay: "—" };
    }
    if (!expiryRaw) {
      return { status: "unable", evidence: "Valid but expiry missing — cannot fully verify", expiryDisplay };
    }
    if (isOldExpiry(expiryRaw)) {
      return { status: "present", evidence: "Valid with Old expiry marker (skipped for alert/expiry)", expiryDisplay };
    }
    const d = parseISO(expiryRaw);
    if (!d) {
      return { status: "unable", evidence: `Valid but expiry “${expiryRaw}” unparseable`, expiryDisplay };
    }
    if (daysUntil(d) < 0) {
      return { status: "expired", evidence: `Valid label but expiry ${expiryDisplay} is past`, expiryDisplay };
    }
    return { status: "verified", evidence: `Valid through ${expiryDisplay}`, expiryDisplay };
  }

  // Unknown / custom status text
  if (opts.statusRaw.trim()) {
    return {
      status: "present",
      evidence: `Non-standard status “${opts.statusRaw.trim()}” — recorded but not verified`,
      expiryDisplay,
    };
  }

  return { status: "unable", evidence: "Unable to classify status", expiryDisplay };
}

type ChecklistDef = {
  key: string;
  category: string;
  document: string;
  sectionId: string;
  statusCol: number;
  dateCol: number | null;
  noExpiryRequired?: boolean;
  /** Skip for owner-operators when true (honest N/A). */
  companyOnly?: boolean;
};

const CHECKLIST: ChecklistDef[] = [
  { key: "dmv", category: "DMV", document: "DMV Pull Notice", sectionId: "dmv", statusCol: 2, dateCol: 3 },
  { key: "medical", category: "Medical", document: "Medical Certificate", sectionId: "medical", statusCol: 1, dateCol: 2 },
  { key: "annual", category: "Clearinghouse", document: "Annual Query", sectionId: "queries", statusCol: 1, dateCol: 2 },
  { key: "preemp", category: "Clearinghouse", document: "Pre-Employment Query", sectionId: "queries", statusCol: 3, dateCol: 4 },
  { key: "cdl", category: "SSC & CDL", document: "CDL", sectionId: "ssccdl", statusCol: 2, dateCol: 3 },
  { key: "ssc", category: "SSC & CDL", document: "Social Security Card", sectionId: "ssccdl", statusCol: 4, dateCol: null, noExpiryRequired: true },
];

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

function docsChecklist(data: AppData): ChecklistDef[] {
  const headers = data.sections.docs?.headers ?? [];
  const items: ChecklistDef[] = [];
  for (let i = 2; i <= 13; i++) {
    const label = (headers[i] ?? DEFAULT_DOC_HEADERS[i - 2] ?? `Document ${i - 1}`).trim();
    items.push({
      key: `docs_${i}`,
      category: "Other Docs",
      document: label || `Document ${i - 1}`,
      sectionId: "docs",
      statusCol: i,
      dateCol: null,
      noExpiryRequired: true,
    });
  }
  return items;
}

function activeDriverIds(data: AppData): string[] {
  const ids = new Set<string>();
  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    for (const r of data.sections[def.id]?.rows ?? []) {
      if (rowIsActive(def, r, data)) ids.add(r.driverId);
    }
  }
  return [...ids];
}

export function buildInspectionItems(data: AppData, driverId: string): InspectionItem[] {
  const name = driverName(data, driverId);
  const oo = isOwnerOperator(data, driverId);
  const defs = [...CHECKLIST, ...docsChecklist(data)];
  const items: InspectionItem[] = [];

  for (const def of defs) {
    if (def.companyOnly && oo) {
      items.push({
        key: `${driverId}:${def.key}`,
        driverId,
        driverName: name,
        category: def.category,
        document: def.document,
        sectionId: def.sectionId,
        rowId: null,
        status: "n_a",
        evidence: "Not applicable for this driver class",
        expiryDisplay: "—",
      });
      continue;
    }

    const row = rowFor(data, def.sectionId, driverId);
    if (!row) {
      items.push({
        key: `${driverId}:${def.key}`,
        driverId,
        driverName: name,
        category: def.category,
        document: def.document,
        sectionId: def.sectionId,
        rowId: null,
        status: "missing",
        evidence: `No row in ${def.sectionId}`,
        expiryDisplay: "—",
      });
      continue;
    }

    const statusRaw = cell(row, def.statusCol);
    const expiryRaw = def.dateCol != null ? cell(row, def.dateCol) : "";
    // Cross-check statusExpiryCol so we stay aligned with Applied×Expiry rules.
    if (def.dateCol != null) {
      const paired = statusExpiryCol(def.sectionId, def.statusCol);
      if (paired != null && paired !== def.dateCol) {
        items.push({
          key: `${driverId}:${def.key}`,
          driverId,
          driverName: name,
          category: def.category,
          document: def.document,
          sectionId: def.sectionId,
          rowId: row.id,
          status: "unable",
          evidence: "Internal column pairing mismatch — unable to verify",
          expiryDisplay: "—",
        });
        continue;
      }
    }

    const mapped = statusFromCell({
      statusRaw,
      expiryRaw,
      ...(def.noExpiryRequired ? { noExpiryRequired: true } : {}),
    });
    items.push({
      key: `${driverId}:${def.key}`,
      driverId,
      driverName: name,
      category: def.category,
      document: def.document,
      sectionId: def.sectionId,
      rowId: row.id,
      status: mapped.status,
      evidence: mapped.evidence,
      expiryDisplay: mapped.expiryDisplay,
    });
  }

  return items;
}

export function buildInspectionSummaries(data: AppData): InspectionDriverSummary[] {
  return activeDriverIds(data)
    .map((driverId) => {
      const items = buildInspectionItems(data, driverId);
      const counts = emptyCounts();
      let worst: InspectionStatus = "n_a";
      for (const it of items) {
        counts[it.status]++;
        worst = worse(worst, it.status);
      }
      return {
        driverId,
        driverName: driverName(data, driverId),
        items,
        counts,
        worst,
      };
    })
    .sort((a, b) => {
      const wr = WORST_RANK.indexOf(a.worst) - WORST_RANK.indexOf(b.worst);
      if (wr) return wr;
      return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" });
    });
}

export function fleetInspectionCounts(summaries: InspectionDriverSummary[]) {
  const counts = emptyCounts();
  let drivers = 0;
  for (const s of summaries) {
    drivers++;
    for (const k of Object.keys(counts) as InspectionStatus[]) counts[k] += s.counts[k];
  }
  return { drivers, ...counts };
}
