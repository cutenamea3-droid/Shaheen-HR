/**
 * Driver Compliance daily summary counts — reuses analyzeRow / CATS-style
 * matchers and driver-meta. Temp notes are never treated as issues.
 */
import { analyzeRow, rowOrdinaryComplianceMuted, type Issue } from "./alerts";
import { SECTIONS, type AppData } from "./sections";
import { countTempNotes, isNewDriver, isOwnerOperator } from "./driver-meta";

export type DriverDailyKey = "expired" | "soon" | "applied" | "tempNotes" | "new" | "oo";

const matchExpired = (i: Issue) => i.tone === "danger" && /expired/i.test(i.label);
const matchSoon = (i: Issue) => i.tone === "warn";
const matchApplied = (i: Issue) => /applied/i.test(i.label);

export type DriverDailyCounts = Record<DriverDailyKey, number>;

/** Issue tallies exclude New / OO / leave / inactive (rowOrdinaryComplianceMuted). */
export function buildDriverDailyCounts(data: AppData): DriverDailyCounts {
  let expired = 0;
  let soon = 0;
  let applied = 0;
  const tempDrivers = new Set<string>();
  const newDrivers = new Set<string>();
  const ooDrivers = new Set<string>();

  for (const def of SECTIONS) {
    const sec = data.sections[def.id];
    if (!sec) continue;
    for (const r of sec.rows) {
      if (isNewDriver(data, r.driverId)) newDrivers.add(r.driverId);
      else if (isOwnerOperator(data, r.driverId)) ooDrivers.add(r.driverId);
      if (countTempNotes(data, r.driverId) > 0) tempDrivers.add(r.driverId);
      if (def.id === "inactive") continue;
      if (rowOrdinaryComplianceMuted(def, r, data)) continue;
      for (const i of analyzeRow(def, sec.headers, r).issues) {
        if (matchExpired(i)) expired++;
        else if (matchSoon(i)) soon++;
        else if (matchApplied(i)) applied++;
      }
    }
  }

  return {
    expired,
    soon,
    applied,
    tempNotes: tempDrivers.size,
    new: newDrivers.size,
    oo: ooDrivers.size,
  };
}
