import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { smartAlertCounts } from "@/lib/alerts";
import { useData } from "@/lib/store";

/**
 * Header Alerts control → full-page Smart Alerts work center (not a right drawer).
 * Badge still uses collectSmartAlerts critical/upcoming/incomplete totals.
 */
export function AlertsBell() {
  const data = useData();
  const counts = useMemo(() => smartAlertCounts(data), [data]);
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => void navigate({ to: "/alerts" })}
      title="Smart Alerts work center"
      aria-label={`Smart Alerts${counts.total ? `, ${counts.total}` : ""}`}
      className={cn(
        "ui-press relative inline-flex items-center gap-2 rounded-lg border-2 bg-card px-3 py-2 text-sm font-bold hover:border-primary hover:text-primary",
        counts.critical > 0 && "border-danger/50 text-danger",
      )}
    >
      <Bell className="size-4" />
      <span className="hidden sm:inline">Alerts</span>
      {counts.total > 0 && (
        <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-primary-foreground">
          {counts.total > 99 ? "99+" : counts.total}
        </span>
      )}
    </button>
  );
}
