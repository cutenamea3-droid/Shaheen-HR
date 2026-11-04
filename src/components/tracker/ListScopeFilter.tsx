import { cn } from "@/lib/utils";
import type { ListScope } from "@/lib/driver-meta";

const LABELS: Record<ListScope, string> = {
  company: "Company",
  owner_operator: "Owner Op",
  new: "New",
};

/** Compact Company | Owner Op | New chips — keep DMV toolbar light. */
export function ListScopeFilter({
  value,
  onChange,
  counts,
  className,
}: {
  value: ListScope;
  onChange: (v: ListScope) => void;
  counts?: Partial<Record<ListScope, number>>;
  className?: string;
}) {
  return (
    <div className={cn("tracker-filter-group", className)} role="group" aria-label="Driver list scope">
      {(["company", "owner_operator", "new"] as ListScope[]).map((s) => {
        const n = counts?.[s];
        const label = n != null ? `${LABELS[s]} (${n})` : LABELS[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={value === s}
            title={
              s === "company"
                ? "Company drivers (excludes New and Owner Operators)"
                : s === "owner_operator"
                  ? "Owner Operators — management class, not Inactive"
                  : "New Drivers — onboarding only until moved to Active"
            }
            className={cn("tracker-filter-btn", value === s && "tracker-filter-btn-on")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
