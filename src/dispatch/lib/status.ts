import type { DispatchLoad, LoadStatus } from "./types";
import { ACTIVE_BOARD_COLUMNS, ACTIVE_LOAD_STATUSES, LOAD_STATUS_LABELS } from "./types";

/**
 * Delivered ≠ Closed ≠ Paid.
 * Closed may reopen only to delivered (Batch 9). Closing never implies paid.
 */
export function canTransition(from: LoadStatus, to: LoadStatus): boolean {
  if (from === to) return true;
  if (from === "cancelled") return false;
  if (from === "closed") return to === "delivered";
  if (to === "cancelled") return true;
  if (to === "closed") return from === "delivered";
  // Delivered only closes (handled above); no other movement transitions.
  if (from === "delivered") return false;
  if (to === "delivered") return true;
  return true;
}

export function isStaleUpdate(load: Pick<DispatchLoad, "updated_at" | "stale_after_minutes" | "status">, now = Date.now()): boolean {
  if (!ACTIVE_LOAD_STATUSES.includes(load.status) && load.status !== "delivered") return false;
  const updated = Date.parse(load.updated_at);
  if (Number.isNaN(updated)) return false;
  const minutes = Math.max(30, load.stale_after_minutes || 180);
  return now - updated > minutes * 60_000;
}

export function statusLabel(status: LoadStatus): string {
  return LOAD_STATUS_LABELS[status] ?? status;
}

export function homeActionBuckets(loads: DispatchLoad[]) {
  const needsUpdate = loads.filter(
    (l) => ACTIVE_LOAD_STATUSES.includes(l.status) && (isStaleUpdate(l) || !l.last_manual_location_at),
  );
  const openExceptions = loads.filter((l) => l.exception_open && l.status !== "closed" && l.status !== "cancelled");
  const awaitingDocs = loads.filter(
    (l) =>
      (l.status === "delivered" || l.status === "at_delivery" || l.status === "closed") &&
      (l.bol_status === "missing" || l.bol_status === "pending" || l.pod_status === "missing" || l.pod_status === "pending"),
  );
  const inMotion = loads.filter((l) =>
    ["assigned", "in_transit", "at_pickup", "loaded", "at_delivery"].includes(l.status),
  );
  /** Delivered but not yet closed — file work remaining. Paid is separate. */
  const awaitingCloseout = loads.filter((l) => l.status === "delivered");
  return { needsUpdate, openExceptions, awaitingDocs, inMotion, awaitingCloseout };
}

/** Group filtered active loads into board columns. Does not invent milestones or ETAs. */
export function activeLoadsBoardColumns(loads: DispatchLoad[]): Array<{
  status: LoadStatus;
  label: string;
  items: DispatchLoad[];
}> {
  return ACTIVE_BOARD_COLUMNS.map((status) => ({
    status,
    label: LOAD_STATUS_LABELS[status],
    items: loads.filter((l) => l.status === status),
  }));
}

export function filterLoads(
  loads: DispatchLoad[],
  query: {
    q?: string;
    status?: LoadStatus | "all" | "active";
    driverId?: string | "all";
    exceptionOnly?: boolean;
  },
): DispatchLoad[] {
  const q = (query.q ?? "").trim().toLowerCase();
  return loads.filter((load) => {
    if (query.exceptionOnly && !load.exception_open) return false;
    if (query.status === "active" && !ACTIVE_LOAD_STATUSES.includes(load.status)) return false;
    if (query.status && query.status !== "all" && query.status !== "active" && load.status !== query.status) {
      return false;
    }
    if (query.driverId && query.driverId !== "all" && load.assigned_driver_id !== query.driverId) return false;
    if (!q) return true;
    const hay = [
      load.load_number,
      load.customer_name,
      load.assigned_driver_name,
      load.commodity,
      load.last_manual_location,
      load.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
