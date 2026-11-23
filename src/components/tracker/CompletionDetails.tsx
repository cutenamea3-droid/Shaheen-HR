/**
 * Completion Details — per-section breakdown for Driver Cards profile %.
 * Clarifies status vs presence vs compliance vs profile completion.
 */
import { cn } from "@/lib/utils";
import type { DriverProfileCompletion, DuplicateDriverWarning } from "@/lib/driver-profile-completion";
import { DUPLICATE_DRIVER_POLICY } from "@/lib/driver-profile-completion";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

const CONCEPT_LABEL: Record<string, string> = {
  compliance: "Compliance",
  presence: "Presence",
  status: "Status",
  profile: "Profile",
};

export function CompletionDetails({
  completion,
  duplicate,
  compact,
}: {
  completion: DriverProfileCompletion;
  duplicate?: DuplicateDriverWarning | null;
  compact?: boolean;
}) {
  const pct = completion.percent;
  const tone = pct >= 90 ? "text-ok" : pct >= 70 ? "text-warn" : "text-danger";

  return (
    <div className={cn("space-y-3", compact ? "text-sm" : "")}>
      <div>
        <div className={cn("font-extrabold tabular-nums", compact ? "text-base" : "font-display text-2xl", tone)}>
          {pct}% profile complete
        </div>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
          {completion.complete}/{completion.applicable} checklist items · not the same as Other Docs
          status
          {completion.otherDocsStatusPercent != null
            ? ` (${completion.otherDocsStatusPercent}% Valid÷12)`
            : ""}
        </p>
        <div className="tracker-doc-bar mt-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
          <div className="tracker-doc-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {duplicate && (
        <div
          className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs font-semibold text-warn"
          role="status"
        >
          <div className="font-extrabold">{asText(duplicate.label)}</div>
          <div className="mt-0.5">{asText(duplicate.detail)}</div>
          <div className="mt-1 text-[11px] opacity-90">{DUPLICATE_DRIVER_POLICY}</div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40 text-[10px] font-extrabold tracking-wider uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">%</th>
              <th className="px-3 py-2">Done</th>
              <th className="px-3 py-2">Row</th>
            </tr>
          </thead>
          <tbody>
            {completion.sections.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-bold">{asText(s.label)}</td>
                <td className="px-3 py-2 tabular-nums font-extrabold">{s.percent}%</td>
                <td className="px-3 py-2 tabular-nums">
                  {s.complete}/{s.applicable}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.rowPresent ? "on file" : "missing"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer text-xs font-extrabold tracking-wide uppercase text-muted-foreground">
          Item breakdown
        </summary>
        <ul className="mt-2 space-y-1.5">
          {completion.sections.flatMap((s) =>
            s.items.map((it) => (
              <li
                key={it.key}
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-1.5 text-xs last:border-0",
                  !it.applicable && "opacity-60",
                )}
              >
                <span>
                  <span className="font-bold">{asText(s.label)}</span>
                  <span className="text-muted-foreground"> · {asText(it.label)}</span>
                  <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {CONCEPT_LABEL[it.concept] ?? it.concept}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    !it.applicable
                      ? "text-muted-foreground"
                      : it.complete
                        ? "text-ok"
                        : "text-danger",
                  )}
                >
                  {it.applicable ? (it.complete ? "✓ " : "✗ ") : ""}
                  {asText(it.display)}
                </span>
              </li>
            )),
          )}
        </ul>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{asText(completion.formula)}</p>
      </details>
    </div>
  );
}
