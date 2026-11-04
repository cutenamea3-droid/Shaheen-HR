import { cn } from "@/lib/utils";
import { EXP_FILTERS, type ExpFilter } from "@/lib/alerts";

export function ExpirationFilter({
  value,
  onChange,
  className,
}: {
  value: ExpFilter;
  onChange: (v: ExpFilter) => void;
  className?: string;
}) {
  return (
    <div className={cn("tracker-toolbar gap-2", className)} role="group" aria-label="Expiration filter">
      <span className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Expiration</span>
      <div className="tracker-filter-group">
        {EXP_FILTERS.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              aria-pressed={active}
              className={cn(
                "tracker-filter-btn ui-press",
                active && f.id === "expired" && "bg-danger text-primary-foreground shadow-card",
                active && (f.id === "d15" || f.id === "d30") && "bg-warn text-primary-foreground shadow-card",
                active && f.id === "compliant" && "bg-ok text-primary-foreground shadow-card",
                active && f.id === "all" && "tracker-filter-btn-on",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
