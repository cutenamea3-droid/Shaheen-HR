/**
 * Batch 8 operational helpers — BOL/POD, follow-ups, equipment board,
 * cancel/reschedule, multi-stop reorder. No invented docs/ETAs/HOS/availability/notifications.
 */
import type {
  DispatchFollowUp,
  DispatchIssue,
  DispatchLoad,
  LoadStop,
  RosterDriver,
} from "./types";
import { ACTIVE_LOAD_STATUSES, LOAD_STATUS_LABELS } from "./types";
import { homeActionBuckets } from "./status";

const DOC_PENDING: Array<DispatchLoad["bol_status"]> = ["missing", "pending", "exception"];

export function isDocAwaiting(status: DispatchLoad["bol_status"] | DispatchLoad["pod_status"]): boolean {
  return DOC_PENDING.includes(status);
}

export function awaitingBolLoads(loads: DispatchLoad[]): DispatchLoad[] {
  return loads.filter(
    (l) =>
      l.status !== "cancelled" &&
      l.status !== "draft" &&
      isDocAwaiting(l.bol_status),
  );
}

export function awaitingPodLoads(loads: DispatchLoad[]): DispatchLoad[] {
  return loads.filter(
    (l) =>
      (l.status === "delivered" || l.status === "at_delivery" || l.status === "closed") &&
      isDocAwaiting(l.pod_status),
  );
}

/** Open desk follow-ups due by `now` (inclusive). Manual reminders only — not notifications. */
export function dueFollowUps(
  followUps: DispatchFollowUp[],
  now = Date.now(),
): DispatchFollowUp[] {
  return followUps
    .filter((f) => f.status === "open" && Date.parse(f.due_at) <= now)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
}

export function openFollowUps(followUps: DispatchFollowUp[]): DispatchFollowUp[] {
  return followUps.filter((f) => f.status === "open").sort((a, b) => a.due_at.localeCompare(b.due_at));
}

export function openEscalations(issues: DispatchIssue[]): DispatchIssue[] {
  return issues.filter((i) => i.status === "open" || i.status === "escalated");
}

export function issuesMissingSeniorInformed(issues: DispatchIssue[]): DispatchIssue[] {
  return openEscalations(issues).filter(
    (i) =>
      !i.senior_informed &&
      (i.escalation_level === "supervisor" ||
        i.escalation_level === "manager" ||
        i.escalation_level === "critical"),
  );
}

export type EquipmentBoardRow = {
  driver: RosterDriver;
  unit_number: string | null;
  /** Equipment labels taken only from assigned active/delivered loads — not invented. */
  equipmentLabels: string[];
  activeLoads: DispatchLoad[];
};

/**
 * Driver / equipment desk board from roster + load records.
 * Does NOT invent HOS, free/busy, or availability status.
 */
export function buildEquipmentBoard(
  drivers: RosterDriver[],
  loads: DispatchLoad[],
): EquipmentBoardRow[] {
  return drivers
    .filter((d) => d.active)
    .map((driver) => {
      const activeLoads = loads.filter(
        (l) =>
          l.assigned_driver_id === driver.id &&
          (ACTIVE_LOAD_STATUSES.includes(l.status) || l.status === "delivered"),
      );
      const equipmentLabels = [
        ...new Set(
          activeLoads
            .map((l) => (l.equipment ?? "").trim())
            .filter(Boolean),
        ),
      ];
      return {
        driver,
        unit_number: driver.unit_number,
        equipmentLabels,
        activeLoads,
      };
    })
    .sort((a, b) => a.driver.display_name.localeCompare(b.driver.display_name));
}

export function canCancelLoad(status: DispatchLoad["status"]): boolean {
  return status !== "closed" && status !== "cancelled";
}

export function validateCancel(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "Cancel requires a manual reason.";
  if (trimmed.length < 3) return "Cancel reason is too short.";
  return null;
}

export function validateReschedule(note: string, plannedPickup: string | null, plannedDelivery: string | null): string | null {
  const trimmed = note.trim();
  if (!trimmed) return "Reschedule requires a manual note (no invented ETAs).";
  if (!plannedPickup && !plannedDelivery) {
    return "Set at least one planned pickup or delivery time when rescheduling.";
  }
  return null;
}

/** Re-number stop sequences after reorder/remove. */
export function renumberStops(stops: LoadStop[]): LoadStop[] {
  return stops.map((s, i) => ({ ...s, sequence: i + 1 }));
}

export function moveStop(stops: LoadStop[], index: number, direction: -1 | 1): LoadStop[] {
  const j = index + direction;
  if (j < 0 || j >= stops.length) return renumberStops(stops);
  const next = [...stops];
  const tmp = next[index];
  next[index] = next[j];
  next[j] = tmp;
  return renumberStops(next);
}

export function removeStop(stops: LoadStop[], index: number): LoadStop[] {
  if (stops.length <= 1) return renumberStops(stops);
  return renumberStops(stops.filter((_, i) => i !== index));
}

/** Handover watch-item hints from live desk state — never invents docs/ETAs. */
export function buildHandoverWatchHints(input: {
  loads: DispatchLoad[];
  issues: DispatchIssue[];
  followUps: DispatchFollowUp[];
}): string {
  const buckets = homeActionBuckets(input.loads);
  const lines: string[] = [];
  if (buckets.awaitingDocs.length) {
    lines.push(
      `BOL/POD awaiting: ${buckets.awaitingDocs.map((l) => l.load_number).join(", ")}`,
    );
  }
  const openIss = openEscalations(input.issues);
  if (openIss.length) {
    lines.push(
      `Open issues: ${openIss.map((i) => i.title).slice(0, 6).join("; ")}`,
    );
  }
  const needSenior = issuesMissingSeniorInformed(input.issues);
  if (needSenior.length) {
    lines.push(
      `Senior Informed still manual/unchecked: ${needSenior.map((i) => i.title).slice(0, 4).join("; ")}`,
    );
  }
  const due = dueFollowUps(input.followUps);
  if (due.length) {
    lines.push(
      `Follow-ups due: ${due.map((f) => f.title).slice(0, 6).join("; ")}`,
    );
  }
  const cancelled = input.loads.filter((l) => l.status === "cancelled").slice(0, 5);
  if (cancelled.length) {
    lines.push(
      `Cancelled (manual reason on file): ${cancelled.map((l) => l.load_number).join(", ")}`,
    );
  }
  const awaitingClose = input.loads.filter((l) => l.status === "delivered").slice(0, 8);
  if (awaitingClose.length) {
    lines.push(
      `Awaiting closeout (Delivered ≠ Closed ≠ Paid): ${awaitingClose.map((l) => l.load_number).join(", ")}`,
    );
  }
  const unpaidClosed = input.loads
    .filter((l) => l.status === "closed" && (l.payment_status === "unpaid" || l.payment_status === "partial"))
    .slice(0, 6);
  if (unpaidClosed.length) {
    lines.push(
      `Closed but unpaid/partial (payment separate): ${unpaidClosed.map((l) => l.load_number).join(", ")}`,
    );
  }
  return lines.join("\n");
}

export function docStatusLabel(status: DispatchLoad["bol_status"]): string {
  return status;
}

export function loadStatusShort(status: DispatchLoad["status"]): string {
  return LOAD_STATUS_LABELS[status] ?? status;
}
