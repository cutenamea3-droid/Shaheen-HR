/**
 * Smart Driver Finder index — read-only aggregation for Quick Find.
 * Uses in-memory AppData only (no network / schema). Selection never mutates rows.
 */
import {
  analyzeRow,
  collectSmartAlerts,
  driverExpiryDays,
  formatDriverStatus,
  normStatus,
  rowAlertsMuted,
  rowDriverStatus,
  type DriverStatus,
  type SmartAlert,
} from "@/lib/alerts";
import {
  countTempNotes,
  formatDriverClass,
  isNewDriver,
  listScopeOf,
  type ListScope,
} from "@/lib/driver-meta";
import { primaryRowForDriver } from "@/lib/driver-selectors";
import { SECTIONS, cellsOf, headersOf, type AppData } from "@/lib/sections";

export type FinderEmploymentLabel = "Active" | "Leave" | "Inactive" | "New";

export interface FinderDriver {
  driverId: string;
  name: string;
  cdl: string;
  /** Employment or New (onboarding) — for badge display. */
  employmentLabel: FinderEmploymentLabel;
  status: DriverStatus;
  scope: ListScope;
  classLabel: string;
  /** Issue count from analyzeRow (muted rows skipped). Always computed. */
  issues: number;
  /**
   * Count of expiry dates within 30 days (or already expired).
   * Always computed from authorized section cells — never invent "None" without this check.
   */
  expiring: number;
  /** True once expiring was derived from driverExpiryDays. */
  expiryChecked: boolean;
  /** Missing / Sign Missing / Invalid status cells in Other Docs. */
  missingDocs: number;
  tempNotes: number;
  infoRowId: string | null;
  docsRowId: string | null;
  /** First smart alert for this driver, if any (for View Alerts deep-link). */
  firstAlert: SmartAlert | null;
}

export function formatExpiringLabel(d: Pick<FinderDriver, "expiryChecked" | "expiring">): string {
  if (!d.expiryChecked) return "Not checked.";
  if (d.expiring > 0) return `${d.expiring} expiring`;
  return "None expiring";
}

export function formatScopeShort(scope: ListScope): string {
  if (scope === "owner_operator") return "OO";
  if (scope === "new") return "New";
  return "Company";
}

/** Build a sorted, de-duplicated driver index for typeahead. */
export function buildFinderDrivers(data: AppData): FinderDriver[] {
  const map = new Map<string, FinderDriver>();
  const alertsByDriver = new Map<string, SmartAlert>();
  for (const a of collectSmartAlerts(data)) {
    if (!alertsByDriver.has(a.driverId)) alertsByDriver.set(a.driverId, a);
  }

  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    const sec = data.sections[def.id];
    if (!sec || !Array.isArray(sec.rows)) continue;
    for (const r of sec.rows) {
      const cells = cellsOf(r);
      let d = map.get(r.driverId);
      if (!d) {
        const status = rowDriverStatus(def, r, data);
        const scope = listScopeOf(data, r.driverId);
        d = {
          driverId: r.driverId,
          name: (cells[0] ?? "").trim(),
          cdl: "",
          employmentLabel: isNewDriver(data, r.driverId) ? "New" : formatDriverStatus(status),
          status,
          scope,
          classLabel: formatDriverClass(scope === "owner_operator" ? "owner_operator" : "company"),
          issues: 0,
          expiring: 0,
          expiryChecked: false,
          missingDocs: 0,
          tempNotes: 0,
          infoRowId: null,
          docsRowId: null,
          firstAlert: alertsByDriver.get(r.driverId) ?? null,
        };
        map.set(r.driverId, d);
      }

      d.status = rowDriverStatus(def, r, data);
      d.scope = listScopeOf(data, r.driverId);
      d.employmentLabel = isNewDriver(data, r.driverId) ? "New" : formatDriverStatus(d.status);
      d.classLabel = formatDriverClass(d.scope === "owner_operator" ? "owner_operator" : "company");
      if (!d.name) d.name = (cells[0] ?? "").trim();

      if (!rowAlertsMuted(def, r, data)) {
        d.issues += analyzeRow(def, headersOf(sec), r).issues.length;
      }

      // Contact / row ids finalized from primary rows below — skip last-wins here.
    }
  }

  return [...map.values()]
    .map((d) => {
      // Recompute issues + contact from primary rows only (same SoT as Cards/File).
      let issues = 0;
      for (const def of SECTIONS) {
        if (def.id === "inactive") continue;
        const row = primaryRowForDriver(data, def.id, d.driverId);
        if (!row) continue;
        const sec = data.sections[def.id];
        if (!rowAlertsMuted(def, row, data) && d.scope === "company") {
          issues += analyzeRow(def, headersOf(sec), row).issues.length;
        }
      }
      const info = primaryRowForDriver(data, "info", d.driverId);
      const docs = primaryRowForDriver(data, "docs", d.driverId);
      const ssccdl = primaryRowForDriver(data, "ssccdl", d.driverId);
      const dmv = primaryRowForDriver(data, "dmv", d.driverId);
      const cdl =
        (cellsOf(ssccdl)[1] ?? "").trim() || (cellsOf(dmv)[1] ?? "").trim() || d.cdl;
      let missingDocs = 0;
      if (docs) {
        const docsDef = SECTIONS.find((s) => s.id === "docs");
        const cells = cellsOf(docs);
        docsDef?.types.forEach((t, i) => {
          if (t !== "status") return;
          const s = normStatus(cells[i] ?? "");
          if (s === "Missing" || s === "Sign Missing" || s === "Invalid") missingDocs++;
        });
      }
      const name =
        (cellsOf(primaryRowForDriver(data, "dmv", d.driverId))[0] ?? "").trim() ||
        (cellsOf(ssccdl)[0] ?? "").trim() ||
        (cellsOf(info)[0] ?? "").trim() ||
        d.name;
      return {
        ...d,
        name,
        cdl,
        issues,
        missingDocs,
        infoRowId: info?.id ?? null,
        docsRowId: docs?.id ?? null,
        expiring: driverExpiryDays(data, d.driverId).filter((n) => n <= 30).length,
        expiryChecked: true,
        tempNotes: countTempNotes(data, d.driverId),
        firstAlert: alertsByDriver.get(d.driverId) ?? null,
      };
    })
    .sort((a, b) => {
      const asN = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));
      return asN(a.name).localeCompare(asN(b.name), undefined, { sensitivity: "base" });
    });
}

/** cmdk value string — name, CDL, and stable driver ID. */
export function finderSearchValue(d: FinderDriver): string {
  const asN = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));
  return `${asN(d.name)} ${asN(d.cdl)} ${asN(d.driverId)}`;
}
