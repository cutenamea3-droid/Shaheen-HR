import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { StickyNote, UserPlus, Users, AlertTriangle, Clock3, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildDriverDailyCounts, type DriverDailyKey } from "@/lib/daily-summary";
import { saveDashboardPrefs, saveDriverCardsPrefs } from "@/lib/uiprefs";
import { useData } from "@/lib/store";

type Chip = {
  id: DriverDailyKey;
  label: string;
  hint: string;
  tone: string;
  icon: typeof AlertTriangle;
};

const CHIPS: Chip[] = [
  { id: "expired", label: "Expired", hint: "Open Driver Cards · Expired filter", tone: "bg-danger text-primary-foreground", icon: AlertTriangle },
  { id: "soon", label: "Soon", hint: "Open Driver Cards · Expiring in 30 days", tone: "bg-warn text-primary-foreground", icon: Clock3 },
  { id: "applied", label: "Applied pending", hint: "Filter dashboard alerts to Applied", tone: "bg-info text-primary-foreground", icon: FileCheck },
  { id: "tempNotes", label: "Temp notes", hint: "Reminders only — never counted as issues", tone: "bg-muted text-foreground", icon: StickyNote },
  { id: "new", label: "New", hint: "New Drivers scope (separate from Active)", tone: "bg-eagle text-primary-foreground", icon: UserPlus },
  { id: "oo", label: "Owner Op", hint: "Owner Operators scope (separate from Inactive)", tone: "bg-brand text-primary-foreground", icon: Users },
];

/**
 * Clickable daily summary — wires into existing filters / scopes.
 * Temp notes never feed issues; New / OO stay on their own list scopes.
 */
export function DailySummary({
  onApplied,
}: {
  /** Dashboard-local: set section alert cat to Applied. */
  onApplied?: () => void;
}) {
  const data = useData();
  const navigate = useNavigate();
  const counts = useMemo(() => buildDriverDailyCounts(data), [data]);

  const go = (id: DriverDailyKey) => {
    if (id === "applied") {
      saveDashboardPrefs({ cat: "applied" });
      onApplied?.();
      return;
    }
    if (id === "expired") {
      saveDriverCardsPrefs({ exp: "expired", listScope: "company", tempNotesOnly: false });
      void navigate({ to: "/drivers", search: { exp: "expired", scope: "company" } });
      return;
    }
    if (id === "soon") {
      saveDriverCardsPrefs({ exp: "d30", listScope: "company", tempNotesOnly: false });
      void navigate({ to: "/drivers", search: { exp: "d30", scope: "company" } });
      return;
    }
    if (id === "tempNotes") {
      saveDriverCardsPrefs({ tempNotesOnly: true, listScope: "company", exp: "all", statusFilter: "all" });
      void navigate({ to: "/drivers", search: { tempNotes: "1", scope: "company" } });
      return;
    }
    if (id === "new") {
      saveDriverCardsPrefs({ listScope: "new", tempNotesOnly: false, exp: "all" });
      void navigate({ to: "/drivers", search: { scope: "new" } });
      return;
    }
    if (id === "oo") {
      saveDriverCardsPrefs({ listScope: "owner_operator", tempNotesOnly: false, exp: "all" });
      void navigate({ to: "/drivers", search: { scope: "owner_operator" } });
    }
  };

  return (
    <section className="ui-lift rounded-2xl border bg-card p-4 shadow-card sm:p-5" aria-label="Driver compliance daily summary">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Daily summary</h2>
          <p className="text-sm text-muted-foreground">Tap a chip to jump to the matching filter. Temp notes are reminders only.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {CHIPS.map((c) => {
          const Icon = c.icon;
          const n = counts[c.id];
          return (
            <button
              key={c.id}
              type="button"
              title={c.hint}
              onClick={() => go(c.id)}
              className={cn(
                "ui-press flex flex-col items-start gap-1 rounded-xl border-2 border-transparent px-3 py-2.5 text-left transition hover:border-primary/40",
                c.tone,
                n === 0 && "opacity-70",
              )}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-90">
                <Icon className="size-3.5" aria-hidden />
                {c.label}
              </span>
              <span className="font-display text-2xl font-extrabold leading-none">{n}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
