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
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Expiration filter">
      <span className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Expiration</span>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border-2 bg-card p-1 shadow-card">
        {EXP_FILTERS.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              className={cn(
                "ui-press rounded-lg px-3 py-1.5 text-sm font-bold transition",
                active && f.id === "expired" && "bg-danger text-primary-foreground shadow-card",
                active && (f.id === "d15" || f.id === "d30") && "bg-warn text-primary-foreground shadow-card",
                active && f.id === "compliant" && "bg-ok text-primary-foreground shadow-card",
                active && f.id === "all" && "bg-brand text-primary-foreground shadow-card",
                !active && "text-muted-foreground hover:text-foreground",
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
