/**
 * Single source of truth selectors for Driver Compliance.
 *
 * Cards, Driver File, completion, and reports must resolve the same primary row
 * per (sectionId, driverId). Never invent fields; never merge/delete rows.
 *
 * Primary-row policy (deterministic):
 * 1. Prefer the row with the most filled cells (richer saved record).
 * 2. Tie-break: earliest addedAt (original Add Driver / seed cohort).
 * 3. Tie-break: stable row.id ascending.
 */
import {
  analyzeRow,
  rowAlertsMuted,
  rowDriverStatus,
  rowIsActive,
  type DriverStatus,
} from "./alerts";
import { listScopeOf, type ListScope } from "./driver-meta";
import {
  SECTIONS,
  cellsOf,
  headersOf,
  normName,
  rowsOf,
  type AppData,
  type Row,
} from "./sections";

export const DRIVER_SELECTOR_POLICY = [
  "Every UI surface reads the same primary row for a stable driverId.",
  "Primary = richest filled cells, then earliest addedAt, then row.id.",
  "Same-driverId multi-rows are warned for review only — never auto-merged or deleted.",
].join(" ");

function asText(v: unknown) {
  return v == null ? "" : typeof v === "string" ? v : String(v);
}

function isFilled(v: unknown) {
  return asText(v).trim() !== "";
}

/** All physical rows for a driver in one section (may be >1 after linkDrivers). */
export function rowsForDriver(data: AppData, sectionId: string, driverId: string): Row[] {
  const rows = data.sections[sectionId]?.rows;
  if (!Array.isArray(rows) || !driverId) return [];
  return rows.filter((r) => r.driverId === driverId);
}

/** Count of non-empty trimmed cells — higher = richer saved record. */
export function rowFilledScore(row: Row | undefined | null): number {
  if (!row) return 0;
  return cellsOf(row).reduce((n, c) => n + (isFilled(c) ? 1 : 0), 0);
}

/**
 * Deterministic primary row for a (section, driverId).
 * Prefer richest data so empty remapped duplicates never shadow filled records.
 */
export function primaryRowForDriver(
  data: AppData,
  sectionId: string,
  driverId: string,
): Row | undefined {
  const rows = rowsForDriver(data, sectionId, driverId);
  if (!rows.length) return undefined;
  if (rows.length === 1) return rows[0];

  return [...rows].sort((a, b) => {
    const scoreDiff = rowFilledScore(b) - rowFilledScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aAt = typeof a.addedAt === "number" ? a.addedAt : Number.POSITIVE_INFINITY;
    const bAt = typeof b.addedAt === "number" ? b.addedAt : Number.POSITIVE_INFINITY;
    if (aAt !== bAt) return aAt - bAt;
    return asText(a.id).localeCompare(asText(b.id));
  })[0];
}

export type DriverContact = {
  driverId: string;
  name: string;
  /** info.cells[1] — Cell Phone (card subtitle under name). */
  phone: string;
  email: string;
  state: string;
  cdl: string;
  /** True when any section has more than one physical row for this driverId. */
  hasMultiRows: boolean;
  multiRowSections: string[];
};

const NAME_SECTION_ORDER = ["dmv", "ssccdl", "medical", "queries", "docs", "info"] as const;

export function driverDisplayName(data: AppData, driverId: string): string {
  for (const id of NAME_SECTION_ORDER) {
    const n = asText(cellsOf(primaryRowForDriver(data, id, driverId))[0]).trim();
    if (n) return n;
  }
  return "(unnamed)";
}

/** Contact fields from primary rows — phone is intentionally info col 1 (Cell Phone). */
export function driverContact(data: AppData, driverId: string): DriverContact {
  const info = primaryRowForDriver(data, "info", driverId);
  const infoCells = cellsOf(info);
  const ssccdl = primaryRowForDriver(data, "ssccdl", driverId);
  const dmv = primaryRowForDriver(data, "dmv", driverId);

  let state = asText(infoCells[3]).trim();
  if (!state) {
    for (const def of SECTIONS) {
      if (def.id === "inactive") continue;
      const row = primaryRowForDriver(data, def.id, driverId);
      if (!row) continue;
      const cells = cellsOf(row);
      def.types.forEach((t, i) => {
        if (t === "state" && !state) state = asText(cells[i]).trim();
      });
    }
  }

  const cdl =
    asText(cellsOf(ssccdl)[1]).trim() || asText(cellsOf(dmv)[1]).trim();

  const multiRowSections: string[] = [];
  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    if (rowsForDriver(data, def.id, driverId).length > 1) multiRowSections.push(def.id);
  }

  return {
    driverId,
    name: driverDisplayName(data, driverId),
    phone: asText(infoCells[1]).trim(),
    email: asText(infoCells[2]).trim(),
    state,
    cdl,
    hasMultiRows: multiRowSections.length > 0,
    multiRowSections,
  };
}

export type DriverCardModel = {
  driverId: string;
  name: string;
  phone: string;
  email: string;
  cdl: string;
  state: string;
  active: boolean;
  status: DriverStatus;
  scope: ListScope;
  /** Issue count from primary rows only (duplicate empty rows ignored). */
  issues: number;
  statusTarget?: { sectionId: string; rowId: string; col: number };
  hasMultiRows: boolean;
};

/** Shared card/file header model — one derivation for Cards and Driver File. */
export function buildDriverCardModel(data: AppData, driverId: string): DriverCardModel {
  const contact = driverContact(data, driverId);
  let active = true;
  let status: DriverStatus = "active";
  let issues = 0;
  let statusTarget: { sectionId: string; rowId: string; col: number } | undefined;
  const scope = listScopeOf(data, driverId);

  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    const row = primaryRowForDriver(data, def.id, driverId);
    if (!row) continue;
    const sec = data.sections[def.id];
    active = rowIsActive(def, row, data);
    status = rowDriverStatus(def, row, data);
    const muted = rowAlertsMuted(def, row, data) || scope !== "company";
    if (!muted) {
      issues += analyzeRow(def, headersOf(sec), row).issues.length;
    }
    const aidx = def.types.indexOf("active");
    if (aidx >= 0 && !statusTarget) {
      statusTarget = { sectionId: def.id, rowId: row.id, col: aidx };
    }
  }

  const model: DriverCardModel = {
    driverId,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    cdl: contact.cdl,
    state: contact.state,
    active,
    status,
    scope,
    issues,
    hasMultiRows: contact.hasMultiRows,
  };
  if (statusTarget) model.statusTarget = statusTarget;
  return model;
}

/** All stable driverIds present in compliance sections (not inactive). */
export function allComplianceDriverIds(data: AppData): string[] {
  const ids = new Set<string>();
  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    for (const r of rowsOf(data.sections[def.id])) {
      if (r.driverId) ids.add(r.driverId);
    }
  }
  return [...ids];
}

export type SameIdMultiRowFinding = {
  driverId: string;
  driverName: string;
  sections: { sectionId: string; rowCount: number; rowIds: string[] }[];
  reviewOnly: true;
  label: string;
  detail: string;
};

/**
 * Detect same-driverId multi-rows (linkDrivers residue). Review-only — no merge/delete.
 */
export function findSameIdMultiRowFindings(data: AppData): SameIdMultiRowFinding[] {
  const out: SameIdMultiRowFinding[] = [];
  for (const driverId of allComplianceDriverIds(data)) {
    const sections: SameIdMultiRowFinding["sections"] = [];
    for (const def of SECTIONS) {
      if (def.id === "inactive") continue;
      const rows = rowsForDriver(data, def.id, driverId);
      if (rows.length > 1) {
        sections.push({
          sectionId: def.id,
          rowCount: rows.length,
          rowIds: rows.map((r) => r.id),
        });
      }
    }
    if (!sections.length) continue;
    const driverName = driverDisplayName(data, driverId);
    const secList = sections.map((s) => `${s.sectionId}×${s.rowCount}`).join(", ");
    out.push({
      driverId,
      driverName,
      sections,
      reviewOnly: true,
      label: "Multiple rows under one driver ID",
      detail: `${driverName} (${driverId}) has duplicate section rows: ${secList}. Review only — nothing was merged or deleted.`,
    });
  }
  return out;
}

export type AddDriverIdentityMatch = {
  driverId: string;
  name: string;
  cdl: string;
  reason: "same_name" | "same_cdl" | "same_name_and_cdl";
  reviewOnly: true;
};

/**
 * Preview matches before Add Driver creates a new id. Review-only — never blocks silently
 * or merges; UI must show existing records and ask the user to confirm.
 */
export function findAddDriverIdentityMatches(
  data: AppData,
  input: { name: string; cdl: string },
): AddDriverIdentityMatch[] {
  const nameKey = normName(input.name);
  const cdlKey = asText(input.cdl).replace(/\s+/g, "").toUpperCase();
  if (!nameKey && !cdlKey) return [];

  const matches: AddDriverIdentityMatch[] = [];
  for (const driverId of allComplianceDriverIds(data)) {
    const contact = driverContact(data, driverId);
    const sameName = !!(nameKey && normName(contact.name) === nameKey);
    const sameCdl = !!(cdlKey && contact.cdl.replace(/\s+/g, "").toUpperCase() === cdlKey);
    if (!sameName && !sameCdl) continue;
    matches.push({
      driverId,
      name: contact.name,
      cdl: contact.cdl,
      reason: sameName && sameCdl ? "same_name_and_cdl" : sameName ? "same_name" : "same_cdl",
      reviewOnly: true,
    });
  }
  return matches;
}
