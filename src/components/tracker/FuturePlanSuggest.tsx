import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FuturePlanSuggestion } from "@/lib/plan-dates";
import { setCell } from "@/lib/store";

/**
 * Suggestion panel — never auto-writes. Apply Suggestion copies into the plan cell
 * via authorized setCell; manual plans stay until the user applies or edits.
 */
export function FuturePlanSuggest({
  suggestion,
  existingPlan,
  sectionId,
  rowId,
  planCol,
  compact,
}: {
  suggestion: FuturePlanSuggestion | null;
  existingPlan: string;
  sectionId: string;
  rowId: string;
  planCol: number | null;
  compact?: boolean;
}) {
  if (!suggestion || planCol == null) return null;

  const apply = () => {
    if (!suggestion.available || suggestion.suppressReapply) return;
    try {
      setCell(sectionId, rowId, planCol, suggestion.text);
      toast.success("Future Plan updated from suggestion");
    } catch (e) {
      toast.error("Could not save Future Plan", {
        description: e instanceof Error ? e.message : "Keep the original plan and retry",
      });
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm",
        compact && "px-2.5 py-1.5 text-[13px]",
      )}
    >
      <div className="font-bold text-foreground">Future Plan suggestion</div>
      {suggestion.suppressReapply ? (
        <p className="mt-1 font-semibold text-info">{suggestion.text}</p>
      ) : !suggestion.available ? (
        <p className="mt-1 font-semibold text-warn">{suggestion.text}</p>
      ) : (
        <>
          <p className="mt-1 font-semibold text-primary">{suggestion.text}</p>
          <dl className="mt-2 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="inline font-bold text-foreground">Source expiry: </dt>
              <dd className="inline">{suggestion.expiryLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-bold text-foreground">Lead time: </dt>
              <dd className="inline">{suggestion.leadDays != null ? `${suggestion.leadDays} calendar days` : "—"}</dd>
            </div>
            <div>
              <dt className="inline font-bold text-foreground">Reminder: </dt>
              <dd className={cn("inline font-semibold", suggestion.overdue ? "text-danger" : "text-foreground")}>
                {suggestion.reminderLabel ?? "—"}
                {suggestion.overdue ? " (overdue)" : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline font-bold text-foreground">Saved plan: </dt>
              <dd className="inline">{existingPlan.trim() ? existingPlan : "None — suggestion not applied yet"}</dd>
            </div>
          </dl>
          {existingPlan.trim() && existingPlan.trim() !== suggestion.text.trim() && (
            <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
              Manual plan preserved — Apply Suggestion only when you choose to replace it.
            </p>
          )}
          <button
            type="button"
            onClick={apply}
            className="ui-press mt-2 inline-flex items-center rounded-lg border-2 border-primary bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:opacity-95"
          >
            Apply Suggestion
          </button>
        </>
      )}
    </div>
  );
}
