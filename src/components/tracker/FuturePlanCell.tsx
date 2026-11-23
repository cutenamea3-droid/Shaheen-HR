import type { Tone } from "@/lib/alerts";
import type { FuturePlanSuggestion } from "@/lib/plan-dates";
import { EditableText } from "./cells";
import { FuturePlanSuggest } from "./FuturePlanSuggest";

/**
 * Future Plans cell — exactly two elements:
 * 1. MY SAVED FUTURE PLAN (always visible; manual edit + cloud save)
 * 2. AUTOMATIC SUGGESTION (collapsed by default under the saved plan)
 *
 * Never auto-expands the suggestion. Notes / Temporary Notes are siblings — untouched.
 */
export function FuturePlanCell({
  sectionId,
  rowId,
  planCol,
  value,
  onSave,
  tone,
  suggestion,
  compact,
  placeholder = "Add future plan",
}: {
  sectionId: string;
  rowId: string;
  planCol: number;
  value: string;
  onSave: (v: string) => void;
  tone?: Tone;
  suggestion: FuturePlanSuggestion | null;
  compact?: boolean;
  placeholder?: string;
}) {
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
        {...(tone ? { tone } : {})}
        placeholder={placeholder}
      />
      <FuturePlanSuggest
        suggestion={suggestion}
        existingPlan={value}
        sectionId={sectionId}
        rowId={rowId}
        planCol={planCol}
        {...(compact ? { compact: true } : {})}
      />
    </div>
  );
}
