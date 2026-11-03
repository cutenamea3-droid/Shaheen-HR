import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  collectSmartAlerts,
  smartAlertCounts,
  type SmartAlert,
  type SmartAlertGroup,
} from "@/lib/alerts";
import { useData } from "@/lib/store";

const GROUPS: { id: SmartAlertGroup; title: string; hint: string; tone: string; badge: string }[] = [
  { id: "critical", title: "Critical", hint: "<7 days or expired", tone: "border-danger/40", badge: "bg-danger text-primary-foreground" },
  { id: "upcoming", title: "Upcoming", hint: "8–30 days", tone: "border-warn/40", badge: "bg-warn text-primary-foreground" },
  { id: "incomplete", title: "Incomplete", hint: "Missing CDL or dates", tone: "border-info/40", badge: "bg-info text-primary-foreground" },
];

export function AlertsBell() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const counts = useMemo(() => smartAlertCounts(data), [data]);
  const alerts = useMemo(() => collectSmartAlerts(data), [data]);
  const navigate = useNavigate();

  function openAlert(a: SmartAlert) {
    setOpen(false);
    if (a.target === "drivers") {
      void navigate({ to: "/drivers", search: { driver: a.driverId } });
      return;
    }
    void navigate({
      to: "/s/$sectionId",
      params: { sectionId: a.sectionId },
      search: { row: a.rowId },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Smart Alerts"
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
            <SheetTitle className="font-display text-xl font-extrabold">Smart Alerts</SheetTitle>
            <SheetDescription>
              {counts.total
                ? `${counts.critical} critical · ${counts.upcoming} upcoming · ${counts.incomplete} incomplete`
                : "No active alerts — fleet looks clear."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {GROUPS.map((g) => {
              const items = alerts.filter((a) => a.group === g.id);
              return (
                <section key={g.id} className={cn("tracker-alert-group", g.tone)}>
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                    <div>
                      <h3 className="text-base font-extrabold tracking-tight">{g.title}</h3>
                      <p className="text-xs font-semibold text-muted-foreground">{g.hint}</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums", g.badge)}>
                      {items.length}
                    </span>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                    {!items.length && (
                      <p className="px-3 py-4 text-center text-sm font-semibold text-ok">All clear ✓</p>
                    )}
                    {items.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => openAlert(a)}
                        className="ui-press tracker-alert-item"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-extrabold leading-tight">{a.driver}</span>
                          <span className="shrink-0 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                            {a.sectionTitle}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-snug">
                          <span className="font-semibold text-primary">{a.document}</span>
                          <span className="text-muted-foreground" aria-hidden>·</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 font-bold",
                              a.group === "critical" ? "text-danger" : a.group === "upcoming" ? "text-warn" : "text-info",
                            )}
                          >
                            <span
                              className={cn(
                                "tracker-status-dot",
                                a.group === "critical" ? "bg-danger" : a.group === "upcoming" ? "bg-warn" : "bg-info",
                              )}
                              aria-hidden
                            />
                            {a.expiryLabel}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
