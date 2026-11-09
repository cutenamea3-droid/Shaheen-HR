/**
 * Driver management axes (orthogonal):
 * - rosterKind: onboarding ("new") vs roster
 * - driverClass: company vs owner_operator (management classification ≠ legal exemption)
 * - DriverStatus / active cell: employment Active | Leave | Inactive
 *
 * Optional Row fields persist via tracker_sections jsonb / localStorage — no Postgres migration.
 * Missing fields = company + roster (never auto-reclassify existing drivers).
 */
import {
  SECTIONS,
  type AppData,
  type ClassHistoryEntry,
  type DriverClass,
  type RosterHistoryEntry,
  type RosterKind,
  type Row,
  type SectionDef,
} from "./sections";

export type { DriverClass, RosterKind, ClassHistoryEntry, RosterHistoryEntry };
export type ListScope = "company" | "owner_operator" | "new";

export interface TempNoteSection {
  sectionId: string;
  sectionTitle: string;
  short: string;
  text: string;
}

/** Sections that declare a Temporary Note column. */
export const TEMPNOTE_SECTIONS = SECTIONS.filter((s) => s.types.includes("tempnote"));

export function parseDriverClass(value?: string | null): DriverClass {
  const k = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (k === "owner_operator" || k === "owner-operator" || k === "oo" || k === "owner") return "owner_operator";
  return "company";
}

export function formatDriverClass(c: DriverClass): string {
  return c === "owner_operator" ? "Owner Operator" : "Company Driver";
}

export function parseRosterKind(value?: string | null): RosterKind {
  const k = (value ?? "").trim().toLowerCase();
  if (k === "new" || k === "onboarding") return "new";
  return "roster";
}

/** Resolve class from any compliance row for this driverId (missing → company). */
export function driverClassOf(data: AppData, driverId: string): DriverClass {
  for (const def of SECTIONS) {
    const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
    if (r?.driverClass) return parseDriverClass(r.driverClass);
  }
  return "company";
}

/** Resolve onboarding kind (missing → roster — never invent "new" for seed drivers). */
export function rosterKindOf(data: AppData, driverId: string): RosterKind {
  for (const def of SECTIONS) {
    const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
    if (r?.rosterKind) return parseRosterKind(r.rosterKind);
  }
  return "roster";
}

export function isNewDriver(data: AppData, driverId: string): boolean {
  return rosterKindOf(data, driverId) === "new";
}

export function isOwnerOperator(data: AppData, driverId: string): boolean {
  return !isNewDriver(data, driverId) && driverClassOf(data, driverId) === "owner_operator";
}

export function isCompanyDriver(data: AppData, driverId: string): boolean {
  return !isNewDriver(data, driverId) && driverClassOf(data, driverId) === "company";
}

/** Which list-scope chip a driver belongs to (mutually exclusive). */
export function listScopeOf(data: AppData, driverId: string): ListScope {
  if (isNewDriver(data, driverId)) return "new";
  if (isOwnerOperator(data, driverId)) return "owner_operator";
  return "company";
}

/**
 * Ordinary company compliance / reminders / default Active lists.
 * New Drivers and Owner Operators are out (OO ≠ Inactive; they have their own scope).
 */
export function inOrdinaryCompanyLists(data: AppData, driverId: string): boolean {
  return isCompanyDriver(data, driverId);
}

/** Match list-scope chip. */
export function matchesListScope(data: AppData, driverId: string, scope: ListScope): boolean {
  return listScopeOf(data, driverId) === scope;
}

/**
 * Employment "Show all" / Active / Inactive views never include New Drivers.
 * Owner Operators are excluded from company scope; included when scope is owner_operator.
 */
export function matchesEmploymentList(
  data: AppData,
  driverId: string,
  scope: ListScope,
  employment: "all" | "active" | "inactive" | "leave",
  isActive: boolean,
  status?: "active" | "leave" | "inactive",
): boolean {
  if (!matchesListScope(data, driverId, scope)) return false;
  if (scope === "new") return true; // New-only list ignores employment chips
  if (employment === "all") return true;
  if (employment === "active") return isActive && status !== "leave";
  if (employment === "leave") return status === "leave";
  if (employment === "inactive") return !isActive;
  return true;
}

/** Nonempty Temporary Note cells across sections — never feeds analyzeRow / alerts. */
export function collectTempNotes(data: AppData, driverId: string): TempNoteSection[] {
  const out: TempNoteSection[] = [];
  for (const def of TEMPNOTE_SECTIONS) {
    const sec = data.sections[def.id];
    if (!sec) continue;
    const row = sec.rows.find((r) => r.driverId === driverId);
    if (!row) continue;
    const idx = def.types.indexOf("tempnote");
    if (idx < 0) continue;
    const text = (row.cells[idx] ?? "").trim();
    if (!text) continue;
    out.push({ sectionId: def.id, sectionTitle: def.title, short: def.short, text });
  }
  return out;
}

export function countTempNotes(data: AppData, driverId: string): number {
  return collectTempNotes(data, driverId).length;
}

/** Patch every compliance row for a driver with the same meta fields (employment-style mirror). */
export function mapDriverRows(data: AppData, driverId: string, patch: (row: Row, def: SectionDef) => Row): AppData {
  const sections = { ...data.sections };
  for (const def of SECTIONS) {
    const sec = sections[def.id];
    if (!sec) continue;
    let touched = false;
    const rows = sec.rows.map((r) => {
      if (r.driverId !== driverId) return r;
      touched = true;
      return patch(r, def);
    });
    if (touched) sections[def.id] = { ...sec, rows };
  }
  return { ...data, sections };
}

export function applyDriverClass(
  data: AppData,
  driverId: string,
  next: DriverClass,
  at = Date.now(),
): AppData {
  const prev = driverClassOf(data, driverId);
  if (prev === next) return data;
  return mapDriverRows(data, driverId, (r) => {
    const entry: ClassHistoryEntry = { at, from: prev, to: next };
    const classHistory = [...(r.classHistory ?? []), entry];
    return { ...r, driverClass: next, classHistory };
  });
}

export function applyRosterKind(
  data: AppData,
  driverId: string,
  next: RosterKind,
  at = Date.now(),
): AppData {
  const prev = rosterKindOf(data, driverId);
  if (prev === next) return data;
  return mapDriverRows(data, driverId, (r) => {
    const entry: RosterHistoryEntry = { at, from: prev, to: next };
    const rosterHistory = [...(r.rosterHistory ?? []), entry];
    return { ...r, rosterKind: next, rosterHistory };
  });
}

// Date of Hire lives in driver-hr/hire-date.ts (parse/format/lengthOfService + applyDateOfHire).

/** Class history for a driver (from any row that has it). */
export function classHistoryOf(data: AppData, driverId: string): ClassHistoryEntry[] {
  for (const def of SECTIONS) {
    const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
    if (r?.classHistory?.length) return r.classHistory;
  }
  return [];
}
