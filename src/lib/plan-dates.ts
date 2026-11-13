/**
 * Shared calendar-date engine for Smart Alerts action dates and Future Plan suggestions.
 *
 * Lead times are copied from existing section alert windows in alerts.ts / sections rules —
 * never invent a universal 14/13. Arithmetic uses local calendar dates (no UTC day-shift).
 */
import {
  dmvDays,
  daysUntil,
  fmtDate,
  isOldExpiry,
  normStatus,
  parseISO,
  today,
} from "./alerts";
import type { Row } from "./sections";

/** Business calendar: local date-only (matches parseISO / today() elsewhere). */
export type PlanWording = "apply" | "call" | "renew" | "follow_up";

export type PlanLeadRule = {
  sectionId: string;
  /** Future Plan column index. */
  planCol: number;
  /** Exact Expiration / due date column. */
  expiryCol: number;
  /** Paired Application status column, when present. */
  statusCol: number | null;
  /** Extra context column (e.g. DMV state at col 8). */
  stateCol?: number;
  /**
   * Fixed lead days, or a resolver (DMV CA=10 / other=20).
   * Source of truth: analyzeRow / collectPlans / section rules — see `source`.
   */
  leadDays: number | ((row: Row) => number);
  wording: PlanWording;
  /** Document label for UI. */
  docLabel: string;
  /** Where this lead came from in code (for audits / reports). */
  source: string;
};

/**
 * Verified lead times from production logic (do not invent):
 * - DMV: dmvDays(state) — CA 10, else 20 (dateIssue + collectPlans derived apply)
 * - Medical Future Plan highlight: 17d ("call driver"); amber expiry window remains 15d
 * - Queries Annual & Pre-Employment: 14d each
 * - CDL: 30d (amber + Future Plans highlight together) — NOT 13; no 13d rule found in code
 */
export const PLAN_LEAD_RULES: PlanLeadRule[] = [
  {
    sectionId: "dmv",
    planCol: 7,
    expiryCol: 3,
    statusCol: 2,
    stateCol: 8,
    leadDays: (row) => dmvDays(row.cells[8] ?? ""),
    wording: "apply",
    docLabel: "DMV Pull Notice",
    source: "alerts.ts dmvDays / dateIssue(c[3], dmvDays) / collectPlans expiry−dmvDays",
  },
  {
    sectionId: "medical",
    planCol: 6,
    expiryCol: 2,
    statusCol: 1,
    leadDays: 17,
    wording: "call",
    docLabel: "Medical Certificate",
    source: "alerts.ts medical Future plan highlight ≤17d; amber dateIssue uses 15d separately",
  },
  {
    sectionId: "queries",
    planCol: 6,
    expiryCol: 2,
    statusCol: 1,
    leadDays: 14,
    wording: "apply",
    docLabel: "Annual Query",
    source: "alerts.ts dateIssue(c[2], 14) + Annual future plan col 6",
  },
  {
    sectionId: "queries",
    planCol: 7,
    expiryCol: 4,
    statusCol: 3,
    leadDays: 14,
    wording: "apply",
    docLabel: "Pre-Employment Query",
    source: "alerts.ts dateIssue(c[4], 14) + Pre-Emp future plan col 7",
  },
  {
    sectionId: "ssccdl",
    planCol: 7,
    expiryCol: 3,
    statusCol: 2,
    leadDays: 30,
    wording: "renew",
    docLabel: "CDL",
    source: "alerts.ts dateIssue(c[3], 30) + Future plan CDL renewal; sections.ts CDL 30 days",
  },
];

export function planRuleFor(sectionId: string, planCol: number): PlanLeadRule | null {
  return PLAN_LEAD_RULES.find((r) => r.sectionId === sectionId && r.planCol === planCol) ?? null;
}

export function planRulesForSection(sectionId: string): PlanLeadRule[] {
  return PLAN_LEAD_RULES.filter((r) => r.sectionId === sectionId);
}

/** Local calendar date at midnight — never Date.UTC / toISOString day shift. */
export function calendarDate(y: number, m0: number, day: number): Date {
  return new Date(y, m0, day);
}

export function addCalendarDays(d: Date, days: number): Date {
  const out = calendarDate(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatSuggestionDate(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${month} ${d.getDate()} (${weekday}), ${d.getFullYear()}`;
}

export function resolveLeadDays(rule: PlanLeadRule, row: Row): number {
  return typeof rule.leadDays === "function" ? rule.leadDays(row) : rule.leadDays;
}

/**
 * Reminder / action date = expiry − leadDays (single subtraction).
 * Callers that already hold this date must not subtract lead again.
 */
export function computeReminderDate(expiry: Date, leadDays: number): Date {
  return addCalendarDays(expiry, -leadDays);
}

export const SUGGESTION_UNAVAILABLE = "Suggested date unavailable — verify document date";

export type FuturePlanSuggestion = {
  available: boolean;
  /** Human plan text to Apply, or unavailable message. */
  text: string;
  /** Reminder/action calendar date (null when unavailable). */
  reminderDate: Date | null;
  reminderISO: string | null;
  reminderLabel: string | null;
  /** Source expiry date. */
  expiryDate: Date | null;
  expiryISO: string | null;
  expiryLabel: string | null;
  leadDays: number | null;
  wording: PlanWording;
  docLabel: string;
  source: string;
  /** Reminder is before today. */
  overdue: boolean;
  overdueDays: number | null;
  /** True when Application status is Applied — do not suggest re-apply. */
  suppressReapply: boolean;
  suppressReason: string | null;
  sectionId: string;
  planCol: number;
  expiryCol: number;
  statusCol: number | null;
};

function wordingText(wording: PlanWording, when: string): string {
  switch (wording) {
    case "call":
      return `Call driver by ${when}`;
    case "renew":
      return `Start CDL renewal by ${when}`;
    case "follow_up":
      return `Follow up on application by ${when}`;
    case "apply":
    default:
      return `I will Apply on ${when}`;
  }
}

/**
 * Build a Future Plan suggestion for one plan column.
 * Never overwrites a saved plan — callers show this separately + Apply Suggestion.
 */
export function buildFuturePlanSuggestion(
  rule: PlanLeadRule,
  row: Row,
  opts?: { /** Already-computed reminder; do not subtract lead again. */ reminderDate?: Date | null },
): FuturePlanSuggestion {
  const lead = resolveLeadDays(rule, row);
  const expiryRaw = row.cells[rule.expiryCol] ?? "";
  const statusRaw = rule.statusCol != null ? (row.cells[rule.statusCol] ?? "") : "";
  const status = normStatus(statusRaw);
  const base = {
    wording: rule.wording,
    docLabel: rule.docLabel,
    source: rule.source,
    sectionId: rule.sectionId,
    planCol: rule.planCol,
    expiryCol: rule.expiryCol,
    statusCol: rule.statusCol,
    leadDays: lead,
  };

  // Applied → status-check / follow-up, never "re-apply" suggestion.
  if (status === "Applied") {
    return {
      ...base,
      available: false,
      text: "Application in progress — follow status in the editor (no re-apply date suggested)",
      reminderDate: null,
      reminderISO: null,
      reminderLabel: null,
      expiryDate: parseISO(expiryRaw),
      expiryISO: parseISO(expiryRaw) ? toISODateLocal(parseISO(expiryRaw)!) : null,
      expiryLabel: parseISO(expiryRaw) ? fmtDate(parseISO(expiryRaw)!) : expiryRaw.trim() || null,
      overdue: false,
      overdueDays: null,
      suppressReapply: true,
      suppressReason: "Status is Applied — task is status-check, not re-apply",
    };
  }

  if (!expiryRaw.trim() || isOldExpiry(expiryRaw)) {
    return {
      ...base,
      available: false,
      text: SUGGESTION_UNAVAILABLE,
      reminderDate: null,
      reminderISO: null,
      reminderLabel: null,
      expiryDate: null,
      expiryISO: null,
      expiryLabel: expiryRaw.trim() || null,
      overdue: false,
      overdueDays: null,
      suppressReapply: false,
      suppressReason: null,
    };
  }

  const expiry = parseISO(expiryRaw);
  if (!expiry) {
    return {
      ...base,
      available: false,
      text: SUGGESTION_UNAVAILABLE,
      reminderDate: null,
      reminderISO: null,
      reminderLabel: null,
      expiryDate: null,
      expiryISO: null,
      expiryLabel: expiryRaw.trim(),
      overdue: false,
      overdueDays: null,
      suppressReapply: false,
      suppressReason: null,
    };
  }

  const reminder =
    opts?.reminderDate != null
      ? calendarDate(
          opts.reminderDate.getFullYear(),
          opts.reminderDate.getMonth(),
          opts.reminderDate.getDate(),
        )
      : computeReminderDate(expiry, lead);

  const left = daysUntil(reminder);
  const overdue = left < 0;
  const when = formatSuggestionDate(reminder);
  const text = wordingText(rule.wording, when);

  return {
    ...base,
    available: true,
    text,
    reminderDate: reminder,
    reminderISO: toISODateLocal(reminder),
    reminderLabel: `${fmtDate(reminder)}${overdue ? ` · ${-left}d overdue` : left === 0 ? " · today" : ` · in ${left}d`}`,
    expiryDate: expiry,
    expiryISO: toISODateLocal(expiry),
    expiryLabel: fmtDate(expiry),
    overdue,
    overdueDays: overdue ? -left : null,
    suppressReapply: false,
    suppressReason: null,
  };
}

/** Suggestion for a plan cell given section + row (null if no rule). */
export function suggestPlanForCell(
  sectionId: string,
  planCol: number,
  row: Row,
): FuturePlanSuggestion | null {
  const rule = planRuleFor(sectionId, planCol);
  if (!rule) return null;
  return buildFuturePlanSuggestion(rule, row);
}

/**
 * Backward-compatible string suggestion (queries-style apply wording).
 * Prefer suggestPlanForCell / buildFuturePlanSuggestion for work-center UI.
 * Default lead 14 matches Annual/Pre-Emp Query rule when no section context.
 */
export function suggestApplyPlanText(expiry: string, daysBefore = 14): string | null {
  if (!expiry || isOldExpiry(expiry)) return null;
  const d = parseISO(expiry);
  if (!d) return null;
  const a = computeReminderDate(d, daysBefore);
  return `I will Apply on ${formatSuggestionDate(a)}`;
}

/** Expiry column paired to a plan column (or -1). */
export function planExpiryCol(sectionId: string, planCol: number): number {
  return planRuleFor(sectionId, planCol)?.expiryCol ?? -1;
}

/** Whether reminder date falls on "today" (local calendar). */
export function isReminderToday(suggestion: FuturePlanSuggestion): boolean {
  if (!suggestion.reminderDate) return false;
  return daysUntil(suggestion.reminderDate) === 0;
}

export function suggestionMatchesToday(suggestion: FuturePlanSuggestion): boolean {
  if (!suggestion.available || !suggestion.reminderDate) return false;
  const t = today();
  const r = suggestion.reminderDate;
  return (
    r.getFullYear() === t.getFullYear() &&
    r.getMonth() === t.getMonth() &&
    r.getDate() === t.getDate()
  );
}
