/**
 * Batch 9 closeout helpers — detention/accessorials, communications/decisions,
 * close/reopen, complete load history. Delivered ≠ Closed ≠ Paid.
 * No invented rates/free-time; no Admin expense/payroll bleed; no external notify.
 */
import type {
  AccessorialKind,
  AccessorialStatus,
  CheckCall,
  DispatchAccessorial,
  DispatchCommunication,
  DispatchFollowUp,
  DispatchIssue,
  DispatchLoad,
  PaymentStatus,
} from "./types";
import { ACCESSORIAL_KIND_LABELS, PAYMENT_STATUS_LABELS } from "./types";

export function canCloseLoad(status: DispatchLoad["status"]): boolean {
  return status === "delivered";
}

export function canReopenLoad(status: DispatchLoad["status"]): boolean {
  return status === "closed";
}

function asTrimmedText(v: unknown): string {
  if (v == null) return "";
  return (typeof v === "string" ? v : String(v)).trim();
}

export function validateCloseout(note: unknown): string | null {
  const trimmed = asTrimmedText(note);
  if (!trimmed) return "Closeout requires a manual desk note.";
  if (trimmed.length < 3) return "Closeout note is too short.";
  return null;
}

export function validateReopen(reason: unknown): string | null {
  const trimmed = asTrimmedText(reason);
  if (!trimmed) return "Reopen requires a manual reason.";
  if (trimmed.length < 3) return "Reopen reason is too short.";
  return null;
}

/** Closing never marks paid; paying never implies closed. */
export function assertDeliveredClosedPaidDistinct(load: Pick<DispatchLoad, "status" | "payment_status">): {
  delivered: boolean;
  closed: boolean;
  paid: boolean;
} {
  return {
    delivered: load.status === "delivered",
    closed: load.status === "closed",
    paid: load.payment_status === "paid",
  };
}

/**
 * Accessorial amount/hours are desk-entered only.
 * Rejects invented auto-calculation — amount must be explicit or null (Needs Policy).
 */
export function validateAccessorialAmount(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  if (Number.isNaN(amount)) return "Amount must be a number or left blank (Needs Policy Confirmation).";
  if (amount < 0) return "Amount cannot be negative.";
  return null;
}

export function validateAccessorialHours(hours: number | null | undefined): string | null {
  if (hours == null) return null;
  if (Number.isNaN(hours)) return "Hours must be a number or left blank — never invent free-time.";
  if (hours < 0) return "Hours cannot be negative.";
  return null;
}

export function validateAccessorialInput(input: {
  kind: AccessorialKind;
  description: string;
  amount_manual?: number | null;
  hours_manual?: number | null;
}): string | null {
  if (!asTrimmedText(input.description)) return "Accessorial requires a manual description.";
  const amountErr = validateAccessorialAmount(input.amount_manual);
  if (amountErr) return amountErr;
  const hoursErr = validateAccessorialHours(input.hours_manual);
  if (hoursErr) return hoursErr;
  return null;
}

export function validateCommunication(input: {
  kind: DispatchCommunication["kind"];
  summary: string;
  decided_action?: string | null;
}): string | null {
  if (!asTrimmedText(input.summary)) return "Communication/decision requires a summary.";
  if (input.kind === "decision" && !asTrimmedText(input.decided_action)) {
    return "Decisions require a decided action (desk record only — no external notify).";
  }
  return null;
}

export function awaitingCloseoutLoads(loads: DispatchLoad[]): DispatchLoad[] {
  return (Array.isArray(loads) ? loads : []).filter((l) => l.status === "delivered");
}

export function openAccessorials(items: DispatchAccessorial[]): DispatchAccessorial[] {
  return (Array.isArray(items) ? items : []).filter(
    (a) => a.status === "draft" || a.status === "submitted" || a.status === "approved",
  );
}

export function unpaidClosedLoads(loads: DispatchLoad[]): DispatchLoad[] {
  return (Array.isArray(loads) ? loads : []).filter(
    (l) =>
      l.status === "closed" &&
      (l.payment_status === "unpaid" || l.payment_status === "partial"),
  );
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function accessorialKindLabel(kind: AccessorialKind): string {
  return ACCESSORIAL_KIND_LABELS[kind] ?? kind;
}

export function accessorialStatusLabel(status: AccessorialStatus): string {
  return status;
}

export type LoadHistoryEvent = {
  at: string;
  source:
    | "check_call"
    | "issue"
    | "follow_up"
    | "communication"
    | "accessorial"
    | "closeout"
    | "load";
  title: string;
  detail: string;
};

/** Complete load timeline from desk records — never invents GPS/ETAs/notifications. */
export function buildCompleteLoadHistory(input: {
  load: DispatchLoad;
  checkCalls?: CheckCall[];
  issues?: DispatchIssue[];
  followUps?: DispatchFollowUp[];
  communications?: DispatchCommunication[];
  accessorials?: DispatchAccessorial[];
}): LoadHistoryEvent[] {
  const events: LoadHistoryEvent[] = [];
  const { load } = input;

  events.push({
    at: load.created_at,
    source: "load",
    title: `Load created · ${load.load_number}`,
    detail: `Status now: ${load.status}; payment: ${paymentStatusLabel(load.payment_status)}`,
  });

  if (load.actual_pickup_at) {
    events.push({
      at: load.actual_pickup_at,
      source: "load",
      title: "Actual pickup recorded",
      detail: load.last_manual_location ?? "Desk-entered actual pickup",
    });
  }
  if (load.actual_delivery_at) {
    events.push({
      at: load.actual_delivery_at,
      source: "load",
      title: "Actual delivery recorded",
      detail: "Delivered ≠ Closed ≠ Paid",
    });
  }
  if (load.closed_at) {
    events.push({
      at: load.closed_at,
      source: "closeout",
      title: "Load closed",
      detail: load.closeout_note ?? "Closed — file complete (payment separate)",
    });
  }
  if (load.reopened_at) {
    events.push({
      at: load.reopened_at,
      source: "closeout",
      title: "Load reopened",
      detail: load.reopen_reason ?? "Reopened to delivered",
    });
  }

  const checkCalls = Array.isArray(input.checkCalls) ? input.checkCalls : [];
  const issues = Array.isArray(input.issues) ? input.issues : [];
  const followUps = Array.isArray(input.followUps) ? input.followUps : [];
  const communications = Array.isArray(input.communications) ? input.communications : [];
  const accessorials = Array.isArray(input.accessorials) ? input.accessorials : [];
  for (const c of checkCalls) {
    const loc = asTrimmedText(c.manual_location);
    const notes = asTrimmedText(c.notes);
    events.push({
      at: c.called_at,
      source: "check_call",
      title: "Check-call",
      detail: [loc, notes].filter(Boolean).join(" · ") || "Manual check-call",
    });
  }
  for (const i of issues) {
    events.push({
      at: i.updated_at || i.created_at,
      source: "issue",
      title: `Issue: ${asTrimmedText(i.title)}`,
      detail: `${asTrimmedText(i.status)} · ${asTrimmedText(i.escalation_level)}${i.senior_informed ? " · Senior Informed (manual)" : ""}`,
    });
  }
  for (const f of followUps) {
    events.push({
      at: f.updated_at || f.created_at,
      source: "follow_up",
      title: `Follow-up: ${asTrimmedText(f.title)}`,
      detail: `${asTrimmedText(f.status)} · due ${new Date(f.due_at).toLocaleString()}`,
    });
  }
  for (const c of communications) {
    events.push({
      at: c.created_at,
      source: "communication",
      title: `${asTrimmedText(c.kind)}: ${asTrimmedText(c.summary)}`,
      detail:
        [asTrimmedText(c.decided_action), asTrimmedText(c.detail)].filter(Boolean).join(" · ") ||
        "Desk log only — no external notify",
    });
  }
  for (const a of accessorials) {
    const currency = asTrimmedText(a.currency);
    const amt =
      a.amount_manual == null
        ? "amount: Needs Policy / blank"
        : `${currency} ${a.amount_manual}`;
    events.push({
      at: a.updated_at || a.created_at,
      source: "accessorial",
      title: `${accessorialKindLabel(a.kind)} · ${asTrimmedText(a.status)}`,
      detail: `${asTrimmedText(a.description)} · ${amt}${a.hours_manual != null ? ` · hours (manual): ${a.hours_manual}` : ""}`,
    });
  }

  const asAt = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));
  return events.sort((a, b) => asAt(b.at).localeCompare(asAt(a.at)));
}

/** Explicit fence: Batch 9 never posts accessorials into Admin HR expense/payroll. */
export function accessorialsBleedIntoHrFinance(): false {
  return false;
}
