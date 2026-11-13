import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/store";
import {
  DATA_QUALITY_POLICY,
  collectDataQualityFindings,
  dataQualityCounts,
  filterDataQualityFindings,
  type DataQualitySeverity,
} from "@/lib/data-quality";

const SEV: { id: DataQualitySeverity | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const SEV_TONE: Record<DataQualitySeverity, string> = {
  high: "border-danger/50 bg-danger/5",
  medium: "border-warn/50 bg-warn/5",
  low: "border-info/40 bg-info/5",
  info: "border-border bg-card",
};

export function DataQualityReview() {
  const data = useData();
  const [severity, setSeverity] = useState<DataQualitySeverity | "all">("all");
  const [q, setQ] = useState("");

  const findings = useMemo(() => collectDataQualityFindings(data), [data]);
  const counts = useMemo(() => dataQualityCounts(findings), [findings]);
  const filtered = useMemo(
    () => filterDataQualityFindings(findings, { severity, q }),
    [findings, severity, q],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-warn text-primary-foreground">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold">Data Quality Review</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{DATA_QUALITY_POLICY}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Finding severity">
        {SEV.map((s) => {
          const n = s.id === "all" ? counts.all : counts[s.id];
          const active = severity === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeverity(s.id)}
              className={cn(
                "ui-press rounded-lg border-2 px-3 py-1.5 text-sm font-bold tabular-nums",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/60",
              )}
            >
              {s.label}
              <span className={cn("ml-2", active ? "" : "text-primary")}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search findings…"
          className="w-full rounded-lg border-2 border-border bg-card py-2 pr-3 pl-10 text-[15px] font-semibold outline-none focus:border-primary"
          aria-label="Search data quality findings"
        />
      </div>

      {!filtered.length ? (
        <div className="rounded-xl border-2 border-ok/40 bg-ok-soft px-5 py-8 text-center">
          <p className="font-display text-xl font-extrabold text-ok">No findings for this filter</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Data quality checks found nothing to review here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((f) => (
            <li key={f.id} className={cn("rounded-xl border-2 p-4", SEV_TONE[f.severity])}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {f.severity} · review only
                  </p>
                  <h3 className="mt-1 text-base font-extrabold">{f.title}</h3>
                  <p className="mt-1 text-sm font-semibold">{f.driverName}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{f.detail}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{f.suggestedReview}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {f.driverId && (
                    <Link
                      to="/drivers"
                      search={{ driver: f.driverId }}
                      className="rounded-lg border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-primary hover:border-primary"
                    >
                      Open driver
                    </Link>
                  )}
                  {f.sectionId && (
                    <Link
                      to="/s/$sectionId"
                      params={{ sectionId: f.sectionId }}
                      search={f.rowId ? { row: f.rowId } : {}}
                      className="rounded-lg border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-primary hover:border-primary"
                    >
                      Open section
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
