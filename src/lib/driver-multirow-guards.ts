/**
 * SHRP-161 — Prevent unintentional same-driverId multi-rows in compliance sections.
 *
 * Legitimate multiples that MUST remain supported:
 * - Multiple Queries / document statuses live in columns of ONE row per section
 * - Drug-test events live in `driver_drug_test_events` (separate table)
 * - Record-tab documents (`rec_*`) may have many rows per person
 * - Historical rosterHistory / notes on a single row
 *
 * Same-driverId multi-rows inside dmv/medical/queries/ssccdl/docs/info are
 * accidental (linkDrivers remap residue) — never create new ones.
 */
import {
  findAddDriverIdentityMatches,
  rowsForDriver,
  type AddDriverIdentityMatch,
} from "./driver-selectors";
import { type AppData, type Row } from "./sections";

/** Compliance dossier sections: at most one physical row per stable driverId. */
export const SINGLE_ROW_COMPLIANCE_SECTION_IDS = [
  "dmv",
  "medical",
  "queries",
  "ssccdl",
  "docs",
  "info",
] as const;

export type SingleRowComplianceSectionId = (typeof SINGLE_ROW_COMPLIANCE_SECTION_IDS)[number];

export const MULTIROW_GUARD_POLICY = [
  "Compliance sections keep ≤1 physical row per driverId.",
  "addRowForDriver / addDriver / linkDrivers must not create same-id multi-rows.",
  "Existing residue stays review-only until an approved reconciliation.",
  "Drug tests, record tabs, and column-level history remain multi-capable.",
].join(" ");

export function isSingleRowComplianceSection(sectionId: string): boolean {
  return (SINGLE_ROW_COMPLIANCE_SECTION_IDS as readonly string[]).includes(sectionId);
}

/** True when this section already has a physical row for driverId. */
export function driverHasRowInSection(
  data: AppData,
  sectionId: string,
  driverId: string,
): boolean {
  if (!driverId) return false;
  return rowsForDriver(data, sectionId, driverId).length > 0;
}

/**
 * Would inserting another row for driverId in sectionId create a same-id multi-row?
 * Only applies to single-row compliance sections.
 */
export function wouldCreateSameIdMultiRow(
  data: AppData,
  sectionId: string,
  driverId: string,
): boolean {
  if (!isSingleRowComplianceSection(sectionId)) return false;
  return driverHasRowInSection(data, sectionId, driverId);
}

export type AddDriverGuardResult =
  | { ok: true; matches: AddDriverIdentityMatch[] }
  | {
      ok: false;
      reason: "identity_match_requires_ack";
      matches: AddDriverIdentityMatch[];
      message: string;
    };

/**
 * Store-level gate before creating a brand-new driverId across wizard sections.
 * Review-only: never merges or deletes. Requires explicit ack when name/CDL matches.
 */
export function guardAddDriverIdentity(
  data: AppData,
  input: { name: string; cdl: string },
  opts?: { acknowledgeIdentityDuplicate?: boolean },
): AddDriverGuardResult {
  const matches = findAddDriverIdentityMatches(data, input);
  if (matches.length && !opts?.acknowledgeIdentityDuplicate) {
    return {
      ok: false,
      reason: "identity_match_requires_ack",
      matches,
      message:
        "Possible existing driver match — acknowledge before creating a separate record. Nothing is merged or deleted.",
    };
  }
  return { ok: true, matches };
}

/**
 * Count same-driverId multi-row section occurrences (fleet audit helper).
 * One occurrence = one (driverId, sectionId) with rowCount > 1.
 */
export function countSameIdMultiRowOccurrences(data: AppData): {
  driversAffected: number;
  sectionOccurrences: number;
  details: { driverId: string; sectionId: string; rowCount: number; rowIds: string[] }[];
} {
  const byDriver = new Map<string, { sectionId: string; rowCount: number; rowIds: string[] }[]>();
  for (const sectionId of SINGLE_ROW_COMPLIANCE_SECTION_IDS) {
    const rows = data.sections[sectionId]?.rows;
    if (!Array.isArray(rows)) continue;
    const counts = new Map<string, Row[]>();
    for (const r of rows) {
      if (!r.driverId) continue;
      const list = counts.get(r.driverId) ?? [];
      list.push(r);
      counts.set(r.driverId, list);
    }
    for (const [driverId, list] of counts) {
      if (list.length < 2) continue;
      const arr = byDriver.get(driverId) ?? [];
      arr.push({
        sectionId,
        rowCount: list.length,
        rowIds: list.map((r) => r.id),
      });
      byDriver.set(driverId, arr);
    }
  }
  const details = [...byDriver.entries()].flatMap(([driverId, sections]) =>
    sections.map((s) => ({ driverId, ...s })),
  );
  return {
    driversAffected: byDriver.size,
    sectionOccurrences: details.length,
    details,
  };
}
