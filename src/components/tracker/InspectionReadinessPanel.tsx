import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ClipboardCheck, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/store";
import {
  INSPECTION_STATUS_LABEL,
  buildInspectionSummaries,
  fleetInspectionCounts,
  type InspectionStatus,
} from "@/lib/inspection-readiness";

const STATUS_FILTERS: { id: InspectionStatus | "all"; label: string }[] = [
  { id: "all", label: "All drivers" },
  { id: "expired", label: "Expired" },
  { id: "missing", label: "Missing" },
  { id: "pending", label: "Pending" },
  { id: "unable", label: "Unable" },
  { id: "verified", label: "Verified" },
];

const STATUS_CHIP: Record<InspectionStatus, string> = {
  verified: "bg-ok text-primary-foreground",
  present: "bg-info text-primary-foreground",
  missing: "bg-danger text-primary-foreground",
  expired: "bg-danger text-primary-foreground",
  pending: "bg-info text-primary-foreground",
  n_a: "bg-muted text-muted-foreground",
  unable: "bg-warn text-primary-foreground",
};

export function InspectionReadinessPanel() {
  const data = useData();
  const [filter, setFilter] = useState<InspectionStatus | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const summaries = useMemo(() => buildInspectionSummaries(data), [data]);
  const fleet = useMemo(() => fleetInspectionCounts(summaries), [summaries]);

  const visible = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return summaries.filter((s) => {
      if (filter !== "all" && s.counts[filter] === 0) return false;
      if (!qq) return true;
      return s.driverName.toLowerCase().includes(qq);
    });
  }, [summaries, filter, q]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold">Inspection Readiness</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Honest statuses only: Verified, Present, Missing, Expired, Pending, N/A, Unable to verify.
              Temporary Notes and Future Plans are not violations. DMV Applied stays Pending (never auto-Valid).
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
          <span className="rounded-lg bg-muted px-3 py-1.5">{fleet.drivers} drivers</span>
          <span className="rounded-lg bg-ok/15 px-3 py-1.5 text-ok">{fleet.verified} verified</span>
          <span className="rounded-lg bg-info/15 px-3 py-1.5 text-info">{fleet.pending} pending</span>
          <span className="rounded-lg bg-danger/15 px-3 py-1.5 text-danger">{fleet.missing} missing</span>
          <span className="rounded-lg bg-danger/15 px-3 py-1.5 text-danger">{fleet.expired} expired</span>
          <span className="rounded-lg bg-warn/15 px-3 py-1.5 text-warn">{fleet.unable} unable</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "ui-press rounded-lg border-2 px-3 py-1.5 text-sm font-bold",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/60",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search driver…"
          className="w-full rounded-lg border-2 border-border bg-card py-2 pr-3 pl-10 text-[15px] font-semibold outline-none focus:border-primary"
          aria-label="Search inspection readiness"
        />
      </div>

      <div className="space-y-3">
        {visible.map((s) => {
          const open = openId === s.driverId;
          return (
            <article key={s.driverId} className="overflow-hidden rounded-xl border-2 border-border bg-card">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.driverId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{s.driverName}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Worst: {INSPECTION_STATUS_LABEL[s.worst]} · {s.counts.verified} verified ·{" "}
                    {s.counts.missing + s.counts.expired} gaps
                  </p>
                </div>
                <Link
                  to="/drivers"
                  search={{ driver: s.driverId }}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-lg border-2 border-border px-3 py-1.5 text-sm font-bold text-primary hover:border-primary"
                >
                  Open record
                </Link>
              </button>
              {open && (
                <div className="space-y-2 border-t px-4 py-3">
                  {s.items.map((it) => (
                    <div
                      key={it.key}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-background/80 p-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-xs font-extrabold",
                              STATUS_CHIP[it.status],
                            )}
                          >
                            {INSPECTION_STATUS_LABEL[it.status]}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground uppercase">
                            {it.category}
                          </span>
                        </div>
                        <p className="mt-1 font-bold">{it.document}</p>
                        <p className="text-sm text-muted-foreground">{it.evidence}</p>
                        <p className="text-sm">
                          <span className="font-bold">Expiry: </span>
                          {it.expiryDisplay}
                        </p>
                      </div>
                      {it.rowId && (
                        <Link
                          to="/s/$sectionId"
                          params={{ sectionId: it.sectionId }}
                          search={{ row: it.rowId }}
                          className="text-sm font-bold text-primary underline"
                        >
                          View in section
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {!visible.length && (
          <p className="rounded-xl border-2 border-border bg-muted/40 px-5 py-8 text-center text-sm font-semibold text-muted-foreground">
            No drivers match this readiness filter.
          </p>
        )}
      </div>
    </div>
  );
}
