import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FuturePlanSuggestion } from "@/lib/plan-dates";
import {
  futurePlanCollapsedCount,
  futurePlanExpandKey,
} from "@/lib/future-plan-expand";
import { useFuturePlanExpand } from "@/lib/use-future-plan-expand";
import { setCell } from "@/lib/store";

/**
 * Suggestion panel — never auto-writes. Apply Suggestion copies into the plan cell
 * via authorized setCell; manual plans stay until the user applies or edits.
 *
 * Hidden by default unless `embedded` (parent FuturePlanCell already expanded).
 * Standalone usage (e.g. Alerts work center) also stays collapsed until the user opens it.
 * Never auto-expands.
 */
export function FuturePlanSuggest({
  suggestion,
  existingPlan,
  sectionId,
  rowId,
  planCol,
  compact,
  embedded = false,
}: {
  suggestion: FuturePlanSuggestion | null;
  existingPlan: string;
  sectionId: string;
  rowId: string;
  planCol: number | null;
  compact?: boolean;
  /** When true, parent already gates visibility — render panel only (no nested toggle). */
  embedded?: boolean;
}) {
  const key =
    planCol != null ? futurePlanExpandKey(sectionId, rowId, planCol) : `${sectionId}:${rowId}:plan`;
  // Embedded panels are gated by FuturePlanCell — never clear the parent's expand key.
  const { open, toggle } = useFuturePlanExpand(key, { clearOnUnmount: !embedded });

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

  const suggestionActionable = Boolean(suggestion.available && !suggestion.suppressReapply);
  const count = futurePlanCollapsedCount({
    hasSuggestion: true,
    suggestionActionable,
    hasSavedPlan: Boolean(existingPlan.trim()),
  });

  const panel = (
    <div
      className={cn(
        "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm",
        compact && "px-2.5 py-1.5 text-[13px]",
      )}
      data-future-plan-suggest
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
              <dd className="inline">
                {suggestion.leadDays != null ? `${suggestion.leadDays} calendar days` : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline font-bold text-foreground">Reminder: </dt>
              <dd
                className={cn(
                  "inline font-semibold",
                  suggestion.overdue ? "text-danger" : "text-foreground",
                )}
              >
                {suggestion.reminderLabel ?? "—"}
                {suggestion.overdue ? " (overdue)" : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline font-bold text-foreground">Saved plan: </dt>
              <dd className="inline">
                {existingPlan.trim() ? existingPlan : "None — suggestion not applied yet"}
              </dd>
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

  // Parent FuturePlanCell already expanded — show panel only.
  if (embedded) return panel;

  // Standalone: collapsed until user opens this driver/column.
  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={false}
        data-future-plan-suggest-toggle
        className={cn(
          "ui-press flex w-full max-w-full items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-left text-sm font-bold text-foreground hover:bg-primary/10",
          compact && "py-0.5 text-[13px]",
        )}
      >
        <span className="shrink-0">Suggestions</span>
        {count > 0 && (
          <span
            className={cn(
              "inline-flex min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-[11px] font-extrabold tabular-nums",
              suggestionActionable ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold text-muted-foreground">
          {suggestion.text}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={true}
        data-future-plan-suggest-toggle
        className={cn(
          "ui-press flex w-full max-w-full items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-left text-sm font-bold text-foreground hover:bg-primary/10",
          compact && "py-0.5 text-[13px]",
        )}
      >
        <span className="shrink-0">Suggestions</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-muted-foreground">Hide</span>
        <ChevronDown className="size-4 shrink-0 rotate-180 text-muted-foreground" aria-hidden />
      </button>
      {panel}
    </div>
  );
}
