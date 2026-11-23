import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/alerts";
import {
  futurePlanCollapsedCount,
  futurePlanExpandKey,
} from "@/lib/future-plan-expand";
import { useFuturePlanExpand } from "@/lib/use-future-plan-expand";
import type { FuturePlanSuggestion } from "@/lib/plan-dates";
import { EditableText } from "./cells";
import { FuturePlanSuggest } from "./FuturePlanSuggest";

/**
 * Compact Future Plans cell — collapsed by default (one-line Plans / chevron / count).
 * Expands only when the user opens this driver+column; accordion closes others.
 * Never auto-expands.
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
  const key = futurePlanExpandKey(sectionId, rowId, planCol);
  const { open, toggle } = useFuturePlanExpand(key);

  const hasSavedPlan = Boolean(value.trim());
  const hasSuggestion = suggestion != null;
  const suggestionActionable = Boolean(
    suggestion?.available && !suggestion.suppressReapply,
  );
  const count = futurePlanCollapsedCount({
    hasSuggestion,
    suggestionActionable,
    hasSavedPlan,
  });

  const preview = hasSavedPlan
    ? value.trim()
    : suggestionActionable
      ? suggestion!.text
      : hasSuggestion
        ? suggestion!.text
        : "No plan yet";

  return (
    <div data-future-plan-cell data-expanded={open ? "true" : "false"}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`future-plan-panel-${key}`}
        className={cn(
          "ui-press flex w-full max-w-full items-center gap-1.5 rounded-md border border-foreground/20 bg-card px-2 py-1 text-left text-sm font-bold text-foreground hover:bg-muted/40",
          compact && "py-0.5 text-[13px]",
          suggestionActionable && "border-primary/40",
        )}
      >
        <span className="shrink-0">Plans</span>
        {count > 0 && (
          <span
            className={cn(
              "inline-flex min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-[11px] font-extrabold tabular-nums",
              suggestionActionable
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
            aria-label={`${count} plan item${count === 1 ? "" : "s"}`}
          >
            {count}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold text-muted-foreground">
          {preview}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={`future-plan-panel-${key}`}
          className="mt-1.5 space-y-1.5"
          data-future-plan-expanded
        >
          <EditableText
            value={value}
            onSave={onSave}
            boxed
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
            embedded
          />
        </div>
      )}
    </div>
  );
}
