import { useMemo, useState } from "react";
import { AUDIT_KIND_LABEL, useHrAuditHistory, type HrAuditKind } from "@/admin/lib/hr-audit-history";
import { SectionTitle, todayStr } from "./common";

const KINDS: { id: "all" | HrAuditKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "month_close", label: "Close" },
  { id: "month_reopen", label: "Reopen" },
  { id: "pdf_management", label: "Mgmt PDF" },
  { id: "pdf_audit", label: "Audit PDF" },
  { id: "pdf_employee", label: "Employee PDF" },
  { id: "perf_followup_add", label: "Follow-up" },
  { id: "reminder_add", label: "Reminder" },
];

/**
 * HR Audit History — reports, month close/reopen, follow-ups, reminders.
 * Does not invent attendance or performance; records operator actions only.
 */
export function AuditHistory() {
  const events = useHrAuditHistory((s) => s.events);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [kind, setKind] = useState<"all" | HrAuditKind>("all");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (month && e.month && e.month !== month) return false;
      if (kind !== "all" && e.kind !== kind) return false;
      return true;
    });
  }, [events, month, kind]);

  return (
    <div className="space-y-4">
      <SectionTitle
        title="HR Audit History"
        sub="Operator actions for PDFs, month closing/reopen, performance follow-ups, and HR reminders. Closing ≠ Paid."
        right={
          <div className="admin-toolbar gap-2">
            <input type="month" className="field w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Audit month filter" />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`tracker-filter-btn ${kind === k.id ? "tracker-filter-btn-on" : ""}`}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((e) => (
          <article key={e.id} className="admin-emp-card flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{AUDIT_KIND_LABEL[e.kind]}</p>
              <p className="text-sm text-muted-foreground">{e.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {e.who} · {new Date(e.at).toLocaleString()}
                {e.month ? ` · ${e.month}` : ""}
              </p>
            </div>
          </article>
        ))}
        {!filtered.length && <p className="panel text-sm text-muted-foreground">No audit events for this filter.</p>}
      </div>
    </div>
  );
}
