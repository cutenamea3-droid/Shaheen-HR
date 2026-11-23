import { daysUntil } from "@/lib/alerts";
import type { FuturePlanHighlight, FuturePlanSuggestion } from "@/lib/plan-dates";
import { computeFuturePlanHighlight, planRuleFor } from "@/lib/plan-dates";
import type { Row } from "@/lib/sections";
import { EditableText } from "./cells";
import { FuturePlanSuggest } from "./FuturePlanSuggest";

/** Derive highlight when a full row is unavailable (unit tests / partial mounts). */
function highlightFromSuggestionOnly(
  sectionId: string,
  planCol: number,
  suggestion: FuturePlanSuggestion | null,
): FuturePlanHighlight | null {
  const rule = planRuleFor(sectionId, planCol);
  if (!rule || !suggestion) return null;
  if (suggestion.suppressReapply) {
    return {
      actionable: false,
      suggestionTone: null,
      leadDays: suggestion.leadDays,
      daysToExpiry: suggestion.expiryDate ? daysUntil(suggestion.expiryDate) : null,
      daysToReminder: null,
      reason: suggestion.suppressReason ?? "Applied",
      sectionId: rule.sectionId,
      planCol: rule.planCol,
      docLabel: rule.docLabel,
    };
  }
  if (!suggestion.available || !suggestion.reminderDate || !suggestion.expiryDate) {
    return {
      actionable: false,
      suggestionTone: null,
      leadDays: suggestion.leadDays,
      daysToExpiry: null,
      daysToReminder: null,
      reason: "No valid expiry",
      sectionId: rule.sectionId,
      planCol: rule.planCol,
      docLabel: rule.docLabel,
    };
  }
  const daysToExpiry = daysUntil(suggestion.expiryDate);
  const daysToReminder = daysUntil(suggestion.reminderDate);
  if (daysToExpiry < 0 || daysToReminder > 0) {
    return {
      actionable: false,
      suggestionTone: null,
      leadDays: suggestion.leadDays,
      daysToExpiry,
      daysToReminder,
      reason: daysToExpiry < 0 ? "Document expired" : "Reminder not due yet",
      sectionId: rule.sectionId,
      planCol: rule.planCol,
      docLabel: rule.docLabel,
    };
  }
  return {
    actionable: true,
    suggestionTone: daysToReminder < 0 ? "danger" : "warn",
    leadDays: suggestion.leadDays,
    daysToExpiry,
    daysToReminder,
    reason: daysToReminder < 0 ? "Reminder overdue" : "Reminder due today",
    sectionId: rule.sectionId,
    planCol: rule.planCol,
    docLabel: rule.docLabel,
  };
}

/**
 * Future Plans cell — exactly two elements:
 * 1. MY SAVED FUTURE PLAN (always visible; manual edit + cloud save) — always neutral
 * 2. AUTOMATIC SUGGESTION (collapsed by default under the saved plan)
 *
 * Reminder highlight cues the suggestion affordance only (section lead rules),
 * never the empty/saved plan text and never pink-row issues.
 * Never auto-expands the suggestion. Notes / Temporary Notes are siblings — untouched.
 */
export function FuturePlanCell({
  sectionId,
  rowId,
  planCol,
  value,
  onSave,
  suggestion,
  compact,
  placeholder = "Add future plan",
  row,
}: {
  sectionId: string;
  rowId: string;
  planCol: number;
  value: string;
  onSave: (v: string) => void;
  /** @deprecated Saved plan stays neutral — ignored. Kept for call-site compat. */
  tone?: unknown;
  suggestion: FuturePlanSuggestion | null;
  compact?: boolean;
  placeholder?: string;
  row?: Row;
}) {
  const rule = planRuleFor(sectionId, planCol);
  const highlight =
    row && rule
      ? computeFuturePlanHighlight(rule, row, suggestion)
      : highlightFromSuggestionOnly(sectionId, planCol, suggestion);

  return (
    <div
      data-future-plan-cell
      className={compact ? "space-y-1" : "space-y-1.5"}
    >
      <div className="mb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        My Saved Future Plan
      </div>
      <EditableText
        value={value}
        onSave={onSave}
        boxed
        className="border-solid border-foreground/15 bg-background text-foreground"
        placeholder={placeholder}
      />
      <FuturePlanSuggest
        suggestion={suggestion}
        existingPlan={value}
        sectionId={sectionId}
        rowId={rowId}
        planCol={planCol}
        reminderActionable={Boolean(highlight?.actionable)}
        suggestionTone={highlight?.suggestionTone ?? null}
        {...(compact ? { compact: true } : {})}
      />
    </div>
  );
}
