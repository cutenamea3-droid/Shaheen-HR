/**
 * Driver Cards profile completion — single reliable % from actual saved section records.
 *
 * Distinguishes four concepts (do not conflate):
 * - Status: recorded Valid / Applied / Missing / … on a status cell (Other Docs score = Valid÷12).
 * - Presence: a section row or Driver Info field exists / is filled.
 * - Compliance: inspection readiness (Verified + Present; expiry-aware) — File Completeness.
 * - Profile completion: Driver Card % = compliance checklist items + Driver Info fields.
 *
 * Temporary Notes and Future Plans are never scored. Nothing is auto-merged or auto-deleted.
 */
import { complianceScore, normStatus } from "./alerts";
import {
  allComplianceDriverIds,
  driverDisplayName,
  findSameIdMultiRowFindings,
  primaryRowForDriver,
} from "./driver-selectors";
import {
  buildInspectionItems,
  type InspectionItem,
  type InspectionStatus,
} from "./inspection-readiness";
import {
  cellsOf,
  normName,
  type AppData,
  type Row,
} from "./sections";

/** Concepts surfaced in Completion Details — keep labels honest. */
export type CompletionConcept = "status" | "presence" | "compliance" | "profile";

export const PROFILE_COMPLETION_FORMULA = [
  "Profile completion % = (complete checklist items) ÷ (applicable items) × 100.",
  "Checklist = DMV + Medical + Clearinghouse (Annual + Pre-Employment) + SSC & CDL + Other Docs (12) + Driver Info (phone, email, state).",
  "Document items complete when compliance status is Verified or Present (same as File Completeness).",
  "Driver Info items complete when the field is filled and not marked In-Valid (presence).",
  "Other Docs “Valid÷12” is a status score only — it is not profile completion.",
  "Applied / Missing / Expired / Unable do not count as complete. Temp Notes and Future Plans are never scored.",
  "N/A items are excluded. Percentages round to the nearest integer. Duplicates are warned only — never auto-merged or deleted.",
].join(" ");

export const COMPLETE_COMPLIANCE: InspectionStatus[] = ["verified", "present"];

export type ProfileSectionId = "dmv" | "medical" | "queries" | "ssccdl" | "docs" | "info";

export const PROFILE_SECTION_ORDER: { id: ProfileSectionId; label: string }[] = [
  { id: "dmv", label: "DMV" },
  { id: "medical", label: "Medical" },
  { id: "queries", label: "Clearinghouse" },
  { id: "ssccdl", label: "SSC & CDL" },
  { id: "docs", label: "Other Docs" },
  { id: "info", label: "Driver Info" },
];

export type ProfileCompletionItem = {
  key: string;
  label: string;
  sectionId: ProfileSectionId;
  /** How this item is judged. */
  concept: CompletionConcept;
  complete: boolean;
  applicable: boolean;
  /** Short human state (Valid, Missing, empty, Verified, …). */
  display: string;
  evidence: string;
};

export type ProfileSectionBreakdown = {
  id: ProfileSectionId;
  label: string;
  complete: number;
  applicable: number;
  percent: number;
  /** Section row present in saved data. */
  rowPresent: boolean;
  items: ProfileCompletionItem[];
};

export type DriverProfileCompletion = {
  driverId: string;
  driverName: string;
  /** THE Driver Card percentage — use this everywhere on cards. */
  percent: number;
  complete: number;
  applicable: number;
  sections: ProfileSectionBreakdown[];
  /**
   * Other Docs status score (Valid÷12, note penalty) — NOT profile completion.
   * null when the driver has no Other Docs row.
   */
  otherDocsStatusPercent: number | null;
  /** Compliance-only % (inspection checklist, excluding Driver Info). */
  compliancePercent: number;
  formula: string;
};

export type DuplicateDriverWarning = {
  driverId: string;
  peerIds: string[];
  reason: "same_name" | "same_cdl" | "same_id_multi_row";
  label: string;
  detail: string;
  /** Explicit: never auto-applied. */
  reviewOnly: true;
};

export const DUPLICATE_DRIVER_POLICY =
  "Possible duplicate drivers are warned by stable driver ID only. Same-ID multi-rows are flagged for review. The app never auto-merges or deletes duplicates.";

const INFO_FIELDS: { col: number; key: string; label: string }[] = [
  { col: 1, key: "phone", label: "Phone" },
  { col: 2, key: "email", label: "Email" },
  { col: 3, key: "state", label: "State" },
];

function asText(v: unknown) {
  return v == null ? "" : typeof v === "string" ? v : String(v);
}

function isFilled(v: unknown) {
  return asText(v).trim() !== "";
}

function cell(row: Row | undefined, i: number) {
  return (cellsOf(row)[i] ?? "").trim();
}

/** Always the shared primary row — never first/last-wins divergence. */
function rowFor(data: AppData, sectionId: string, driverId: string): Row | undefined {
  return primaryRowForDriver(data, sectionId, driverId);
}

function driverName(data: AppData, driverId: string): string {
  return driverDisplayName(data, driverId);
}

function mapCategoryToSection(category: string): ProfileSectionId {
  switch (category) {
    case "DMV":
      return "dmv";
    case "Medical":
      return "medical";
    case "Clearinghouse":
      return "queries";
    case "SSC & CDL":
      return "ssccdl";
    case "Other Docs":
      return "docs";
    default:
      return "docs";
  }
}

function itemFromInspection(it: InspectionItem): ProfileCompletionItem {
  const sectionId = mapCategoryToSection(it.category);
  const applicable = it.status !== "n_a";
  const complete = applicable && COMPLETE_COMPLIANCE.includes(it.status);
  return {
    key: it.key,
    label: it.document,
    sectionId,
    concept: "compliance",
    complete,
    applicable,
    display: it.status,
    evidence: it.evidence,
  };
}

function infoItems(data: AppData, driverId: string): ProfileCompletionItem[] {
  const row = rowFor(data, "info", driverId);
  if (!row) {
    return INFO_FIELDS.map((f) => ({
      key: `info:${f.key}`,
      label: f.label,
      sectionId: "info" as const,
      concept: "presence" as const,
      complete: false,
      applicable: true,
      display: "missing row",
      evidence: "No Drivers Information row on file",
    }));
  }
  return INFO_FIELDS.map((f) => {
    const raw = cell(row, f.col);
    const invalid = /^in-?valid$/i.test(raw);
    const complete = isFilled(raw) && !invalid;
    return {
      key: `info:${f.key}`,
      label: f.label,
      sectionId: "info" as const,
      concept: "presence" as const,
      complete,
      applicable: true,
      display: !raw ? "empty" : invalid ? "In-Valid" : "present",
      evidence: !raw
        ? `${f.label} empty`
        : invalid
          ? `${f.label} marked In-Valid`
          : `${f.label} on file`,
    };
  });
}

function scoreItems(items: ProfileCompletionItem[]): { complete: number; applicable: number; percent: number } {
  let complete = 0;
  let applicable = 0;
  for (const it of items) {
    if (!it.applicable) continue;
    applicable++;
    if (it.complete) complete++;
  }
  const percent = applicable === 0 ? 100 : Math.round((complete / applicable) * 100);
  return { complete, applicable, percent };
}

/** Single reliable profile completion from actual saved records. */
export function buildDriverProfileCompletion(
  data: AppData,
  driverId: string,
): DriverProfileCompletion {
  const name = driverName(data, driverId);
  const inspection = buildInspectionItems(data, driverId).map(itemFromInspection);
  const info = infoItems(data, driverId);
  const all = [...inspection, ...info];

  const sections: ProfileSectionBreakdown[] = PROFILE_SECTION_ORDER.map(({ id, label }) => {
    const items = all.filter((x) => x.sectionId === id);
    const scored = scoreItems(items);
    return {
      id,
      label,
      complete: scored.complete,
      applicable: scored.applicable,
      percent: scored.percent,
      rowPresent: !!rowFor(data, id, driverId),
      items,
    };
  });

  const overall = scoreItems(all);
  const compliance = scoreItems(inspection);

  const docsRow = rowFor(data, "docs", driverId);
  const otherDocsStatusPercent = docsRow ? complianceScore(docsRow) : null;

  return {
    driverId,
    driverName: name,
    percent: overall.percent,
    complete: overall.complete,
    applicable: overall.applicable,
    sections,
    otherDocsStatusPercent,
    compliancePercent: compliance.percent,
    formula: PROFILE_COMPLETION_FORMULA,
  };
}

/** Card % helper — same math as buildDriverProfileCompletion.percent. */
export function driverProfileCompletionPercent(data: AppData, driverId: string): number {
  return buildDriverProfileCompletion(data, driverId).percent;
}

function cdlOf(data: AppData, driverId: string): string {
  const row = rowFor(data, "ssccdl", driverId);
  return cell(row, 1).replace(/\s+/g, "").toUpperCase();
}

/**
 * Detect possible duplicate drivers by stable IDs (same normalized name or same CDL,
 * different driverId) PLUS same-driverId multi-row residue. Review-only — never merges or deletes.
 */
export function findDuplicateDriverWarnings(data: AppData): DuplicateDriverWarning[] {
  const ids = allComplianceDriverIds(data);
  const byName = new Map<string, string[]>();
  const byCdl = new Map<string, string[]>();

  for (const driverId of ids) {
    const nameKey = normName(driverName(data, driverId));
    if (nameKey && nameKey !== "(unnamed)") {
      const list = byName.get(nameKey) ?? [];
      if (!list.includes(driverId)) list.push(driverId);
      byName.set(nameKey, list);
    }
    const cdl = cdlOf(data, driverId);
    if (cdl) {
      const list = byCdl.get(cdl) ?? [];
      if (!list.includes(driverId)) list.push(driverId);
      byCdl.set(cdl, list);
    }
  }

  const byDriver = new Map<string, DuplicateDriverWarning>();

  const push = (
    driverId: string,
    peers: string[],
    reason: DuplicateDriverWarning["reason"],
    label: string,
    detail: string,
  ) => {
    const peerIds = peers.filter((p) => p !== driverId);
    const existing = byDriver.get(driverId);
    if (existing) {
      const merged = [...new Set([...existing.peerIds, ...peerIds])];
      byDriver.set(driverId, {
        ...existing,
        peerIds: merged,
        reason: existing.reason === "same_id_multi_row" ? existing.reason : reason,
        detail: `${existing.detail} · ${detail}`,
        label: existing.reason === "same_id_multi_row" ? existing.label : label,
      });
      return;
    }
    byDriver.set(driverId, {
      driverId,
      peerIds,
      reason,
      label,
      detail,
      reviewOnly: true,
    });
  };

  for (const [, list] of byName) {
    if (list.length < 2) continue;
    for (const id of list) {
      push(
        id,
        list,
        "same_name",
        "Possible duplicate name",
        `Same name under ${list.length} driver IDs (${list.join(", ")})`,
      );
    }
  }
  for (const [cdl, list] of byCdl) {
    if (list.length < 2) continue;
    for (const id of list) {
      push(
        id,
        list,
        "same_cdl",
        "Possible duplicate CDL",
        `CDL ${cdl} shared by ${list.length} driver IDs (${list.join(", ")})`,
      );
    }
  }

  for (const finding of findSameIdMultiRowFindings(data)) {
    push(
      finding.driverId,
      [],
      "same_id_multi_row",
      finding.label,
      finding.detail,
    );
  }

  return [...byDriver.values()];
}

/** Lookup helper for Driver Cards. */
export function duplicateWarningForDriver(
  warnings: DuplicateDriverWarning[],
  driverId: string,
): DuplicateDriverWarning | undefined {
  const list = Array.isArray(warnings) ? warnings : [];
  return list.find((w) => w.driverId === driverId);
}

/** Status-only helper for Other Docs labeling (does not mutate). */
export function otherDocsValidCount(row: Row | undefined): { valid: number; total: number } {
  if (!row) return { valid: 0, total: 12 };
  const cells = cellsOf(row);
  let valid = 0;
  for (let i = 2; i <= 13; i++) if (normStatus(cells[i]) === "Valid") valid++;
  return { valid, total: 12 };
}
