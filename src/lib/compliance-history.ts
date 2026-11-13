/**
 * Compliance History timeline — reuse existing audit sources only.
 * Never invents history events. Gaps are labeled honestly.
 *
 * Sources:
 * - Row.addedAt (wizard add)
 * - classHistory / rosterHistory on rows
 * - Portal activity (cloud or local cache) — when provided by caller
 * - Sensitive in-memory audit (rate/drug) — when provided
 */
import { fmtDate } from "./alerts";
import { classHistoryOf, rosterKindOf, driverClassOf } from "./driver-meta";
import { SECTIONS, type AppData, type RosterHistoryEntry } from "./sections";
import type { LocalActivity } from "./portal-local";
import type { SensitiveAuditEntry } from "./driver-hr/sensitive-audit";

export type HistorySource =
  | "added_at"
  | "class_history"
  | "roster_history"
  | "portal_activity"
  | "sensitive_audit";

export type ComplianceHistoryEvent = {
  id: string;
  at: number;
  atLabel: string;
  source: HistorySource;
  title: string;
  detail: string;
  driverId: string | null;
  actor: string | null;
  sectionId: string | null;
};

export type PortalActivityLike = {
  id: string | number;
  actor_name: string;
  action: string;
  section_id: string;
  occurred_at: string;
};

function nameOf(data: AppData, driverId: string): string {
  for (const def of SECTIONS) {
    const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
    const n = (r?.cells[0] ?? "").trim();
    if (n) return n;
  }
  return driverId;
}

function rosterHistoryOf(data: AppData, driverId: string): RosterHistoryEntry[] {
  for (const def of SECTIONS) {
    const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
    if (r?.rosterHistory?.length) return r.rosterHistory;
  }
  return [];
}

function allDriverIds(data: AppData): string[] {
  const ids = new Set<string>();
  for (const def of SECTIONS) {
    for (const r of data.sections[def.id]?.rows ?? []) ids.add(r.driverId);
  }
  return [...ids];
}

function labelTime(at: number): string {
  try {
    return new Date(at).toLocaleString();
  } catch {
    return String(at);
  }
}

/** Build timeline from known durable / in-memory sources. Does not invent events. */
export function buildComplianceHistory(
  data: AppData,
  opts?: {
    portalActivity?: PortalActivityLike[] | LocalActivity[];
    sensitiveAudit?: SensitiveAuditEntry[];
    driverId?: string;
    limit?: number;
  },
): ComplianceHistoryEvent[] {
  const events: ComplianceHistoryEvent[] = [];
  const filterDriver = opts?.driverId;
  const drivers = filterDriver ? [filterDriver] : allDriverIds(data);

  for (const driverId of drivers) {
    const name = nameOf(data, driverId);

    // addedAt — first seen on any row for this driver
    let addedAt: number | undefined;
    for (const def of SECTIONS) {
      const r = data.sections[def.id]?.rows.find((x) => x.driverId === driverId);
      if (r?.addedAt != null && (addedAt == null || r.addedAt < addedAt)) addedAt = r.addedAt;
    }
    if (addedAt != null) {
      events.push({
        id: `added:${driverId}:${addedAt}`,
        at: addedAt,
        atLabel: labelTime(addedAt),
        source: "added_at",
        title: "Driver added",
        detail: `${name} was added via Add Driver (wizard timestamp).`,
        driverId,
        actor: null,
        sectionId: null,
      });
    }

    for (const h of classHistoryOf(data, driverId)) {
      events.push({
        id: `class:${driverId}:${h.at}:${h.from}:${h.to}`,
        at: h.at,
        atLabel: labelTime(h.at),
        source: "class_history",
        title: "Driver class changed",
        detail: `${name}: ${h.from} → ${h.to} (current: ${driverClassOf(data, driverId)}).`,
        driverId,
        actor: null,
        sectionId: null,
      });
    }

    for (const h of rosterHistoryOf(data, driverId)) {
      events.push({
        id: `roster:${driverId}:${h.at}:${h.from}:${h.to}`,
        at: h.at,
        atLabel: labelTime(h.at),
        source: "roster_history",
        title: "Roster kind changed",
        detail: `${name}: ${h.from} → ${h.to} (current: ${rosterKindOf(data, driverId)}).`,
        driverId,
        actor: null,
        sectionId: null,
      });
    }
  }

  // Portal activity — section-level; attribute to a driver only when action text contains the name.
  for (const entry of opts?.portalActivity ?? []) {
    const at = Date.parse(entry.occurred_at);
    if (!Number.isFinite(at)) continue;

    let matchedDriver: string | null = null;
    for (const driverId of allDriverIds(data)) {
      const n = nameOf(data, driverId).toLowerCase();
      if (n && n !== "(unnamed)" && entry.action.toLowerCase().includes(n)) {
        matchedDriver = driverId;
        break;
      }
    }

    // When filtering to one driver, skip events we cannot attribute to them (never invent).
    if (filterDriver && matchedDriver !== filterDriver) continue;

    events.push({
      id: `portal:${entry.id}`,
      at,
      atLabel: labelTime(at),
      source: "portal_activity",
      title: "Portal activity",
      detail: matchedDriver
        ? entry.action
        : `${entry.action} (section ${entry.section_id}; driver not attributed — no invented link)`,
      driverId: matchedDriver,
      actor: entry.actor_name || null,
      sectionId: entry.section_id || null,
    });
  }

  for (const entry of opts?.sensitiveAudit ?? []) {
    if (filterDriver && entry.driverId !== filterDriver) continue;
    events.push({
      id: `sensitive:${entry.id}`,
      at: entry.at,
      atLabel: labelTime(entry.at),
      source: "sensitive_audit",
      title: `Sensitive: ${entry.action}`,
      detail: entry.detail
        ? `${entry.action} · ${entry.detail}`
        : entry.action,
      driverId: entry.driverId,
      actor: entry.actor || null,
      sectionId: null,
    });
  }

  events.sort((a, b) => b.at - a.at);
  const limit = opts?.limit ?? 500;
  return events.slice(0, limit);
}

/** Honest empty-state copy when no durable history exists for a driver. */
export function complianceHistoryEmptyMessage(driverFiltered: boolean): string {
  if (driverFiltered) {
    return "No recorded history for this driver yet. Class/roster changes, Add Driver timestamps, and attributable portal activity appear here — nothing is invented.";
  }
  return "No compliance history events found from audit sources. Activity Logs, class/roster history, and sensitive audits feed this timeline when present.";
}

export function historySourceLabel(source: HistorySource): string {
  switch (source) {
    case "added_at":
      return "Add Driver";
    case "class_history":
      return "Class history";
    case "roster_history":
      return "Roster history";
    case "portal_activity":
      return "Portal activity";
    case "sensitive_audit":
      return "Sensitive audit";
  }
}

/** Date-only helper for tests / exports. */
export function historyDayLabel(at: number): string {
  return fmtDate(new Date(at));
}
