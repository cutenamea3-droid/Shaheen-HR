import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FuturePlanSuggestion } from "@/lib/plan-dates";
import { futurePlanExpandKey } from "@/lib/future-plan-expand";
import { useFuturePlanExpand } from "@/lib/use-future-plan-expand";
import { setCell } from "@/lib/store";

/**
 * Automatic suggestion panel — never auto-writes.
 * Collapsed by default as "View Automatic Suggestion".
 * Apply Suggestion requires explicit action; confirm before replacing a different saved plan.
 * Open/close never modifies saved data. Never auto-expands.
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
  const key =
    planCol != null ? futurePlanExpandKey(sectionId, rowId, planCol) : `${sectionId}:${rowId}:plan`;
  const { open, toggle } = useFuturePlanExpand(key);

  if (!suggestion || planCol == null) return null;

  const savedTrim = existingPlan.trim();
  const suggestionTrim = suggestion.text.trim();
  const matchesSaved =
    Boolean(savedTrim) &&
    savedTrim === suggestionTrim &&
    suggestion.available &&
    !suggestion.suppressReapply;
  const suggestionActionable = Boolean(suggestion.available && !suggestion.suppressReapply);

  const apply = () => {
    if (!suggestion.available || suggestion.suppressReapply) return;
    if (matchesSaved) return;
    if (savedTrim && savedTrim !== suggestionTrim) {
      const ok = window.confirm(
        "Replace your saved Future Plan with this automatic suggestion?\n\nYour current saved plan will be overwritten.",
      );
      if (!ok) return;
    }
    try {
      setCell(sectionId, rowId, planCol, suggestion.text);
      toast.success("Future Plan updated from suggestion");
    } catch (e) {
      toast.error("Could not save Future Plan", {
        description: e instanceof Error ? e.message : "Keep the original plan and retry",
      });
    }
  };

  const panel = (
    <div
      className={cn(
        "rounded-lg border border-foreground/15 bg-muted/30 px-3 py-2 text-sm",
        compact && "px-2.5 py-1.5 text-[13px]",
      )}
      data-future-plan-suggest
    >
      {suggestion.suppressReapply ? (
        <p className="font-semibold text-info">{suggestion.text}</p>
      ) : !suggestion.available ? (
        <p className="font-semibold text-warn">{suggestion.text}</p>
      ) : matchesSaved ? (
        <p className="font-semibold text-muted-foreground">Already matches saved plan.</p>
      ) : (
        <>
          <p className="font-semibold text-foreground">{suggestion.text}</p>
          <dl className="mt-2 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2">
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
          </dl>
          {suggestionActionable && (
            <button
              type="button"
              onClick={apply}
              className="ui-press mt-2 inline-flex items-center rounded-lg border-2 border-primary bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:opacity-95"
            >
              Apply Suggestion
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        data-future-plan-suggest-toggle
        className={cn(
          "ui-press flex w-full max-w-full items-center gap-1.5 rounded-md border border-foreground/15 bg-card px-2 py-1 text-left text-sm font-bold text-foreground hover:bg-muted/40",
          compact && "py-0.5 text-[13px]",
        )}
      >
        <span className="min-w-0 flex-1">View Automatic Suggestion</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && panel}
    </div>
  );
}
