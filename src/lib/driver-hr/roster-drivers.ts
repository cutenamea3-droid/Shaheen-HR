/**
 * Roster helpers for Drug Test Records (Driver Compliance AppData — not Admin).
 */
import { SECTIONS, cellsOf, type AppData } from "@/lib/sections";

export type RosterDriverRef = {
  driverId: string;
  name: string;
};

/** Unique drivers from compliance sections (excludes inactive-only archive). */
export function listRosterDrivers(data: AppData): RosterDriverRef[] {
  const map = new Map<string, RosterDriverRef>();
  for (const def of SECTIONS) {
    if (def.id === "inactive") continue;
    const sec = data.sections[def.id];
    if (!sec || !Array.isArray(sec.rows)) continue;
    for (const r of sec.rows) {
      const id = r.driverId;
      if (!id) continue;
      const name = (cellsOf(r)[0] ?? "").trim();
      const prev = map.get(id);
      if (!prev) {
        map.set(id, { driverId: id, name });
      } else if (!prev.name && name) {
        prev.name = name;
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function filterRosterDrivers(drivers: RosterDriverRef[], q: string): RosterDriverRef[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return drivers;
  return drivers.filter(
    (d) => d.name.toLowerCase().includes(needle) || d.driverId.toLowerCase().includes(needle),
  );
}
