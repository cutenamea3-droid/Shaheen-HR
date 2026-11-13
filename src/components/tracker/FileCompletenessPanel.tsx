import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Percent } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/store";
import {
  buildFileCompletenessReport,
  downloadFileCompletenessCsv,
  downloadFileCompletenessPdf,
  printFileCompletenessSummary,
} from "@/lib/file-completeness";

export function FileCompletenessPanel() {
  const data = useData();
  const report = useMemo(() => buildFileCompletenessReport(data), [data]);

  const tone =
    report.fleetPercent >= 90 ? "text-ok" : report.fleetPercent >= 70 ? "text-warn" : "text-danger";
  const bar =
    report.fleetPercent >= 90 ? "bg-ok" : report.fleetPercent >= 70 ? "bg-warn" : "bg-danger";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Percent className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold">File Completeness</h2>
              <p className={cn("mt-1 font-display text-4xl font-extrabold", tone)}>
                {report.fleetPercent}%
              </p>
              <p className="text-sm font-semibold text-muted-foreground">
                Fleet · {report.fleetComplete}/{report.fleetApplicable} applicable items ·{" "}
                {report.drivers.length} active drivers
              </p>
              <div className="mt-2 h-3 w-56 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", bar)} style={{ width: `${report.fleetPercent}%` }} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-press inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-bold hover:border-primary"
              onClick={() => {
                downloadFileCompletenessCsv(report);
                toast.success("File Completeness CSV downloaded");
              }}
            >
              <FileSpreadsheet className="size-4" /> CSV
            </button>
            <button
              type="button"
              className="ui-press inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-bold hover:border-primary"
              onClick={() => {
                downloadFileCompletenessPdf(report);
                toast.success("File Completeness PDF downloaded");
              }}
            >
              <Download className="size-4" /> PDF
            </button>
            <button
              type="button"
              className="ui-press inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
              onClick={() => {
                printFileCompletenessSummary(report);
              }}
            >
              Print view
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm font-semibold text-muted-foreground">
          <span className="font-extrabold text-foreground">How % is calculated: </span>
          {report.formula}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border-2 border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs font-extrabold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">%</th>
              <th className="px-4 py-3">Complete</th>
              <th className="px-4 py-3">Missing</th>
              <th className="px-4 py-3">Expired</th>
              <th className="px-4 py-3">Pending</th>
              <th className="px-4 py-3">Unable</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {report.drivers.map((d) => (
              <tr key={d.driverId} className="border-b last:border-0">
                <td className="px-4 py-3 font-bold">
                  <Link
                    to="/drivers"
                    search={{ driver: d.driverId }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {d.driverName}
                  </Link>
                </td>
                <td className="px-4 py-3 font-extrabold tabular-nums">{d.percent}%</td>
                <td className="px-4 py-3 tabular-nums">
                  {d.complete}/{d.applicable}
                </td>
                <td className="px-4 py-3 tabular-nums">{d.missing}</td>
                <td className="px-4 py-3 tabular-nums">{d.expired}</td>
                <td className="px-4 py-3 tabular-nums">{d.pending}</td>
                <td className="px-4 py-3 tabular-nums">{d.unable}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.formulaNote}</td>
              </tr>
            ))}
            {!report.drivers.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No active drivers to score.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
