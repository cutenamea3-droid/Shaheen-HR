import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useApp } from "@/admin/lib/store";
import { getSyncStatus, subscribeSync } from "@/admin/lib/cloud-sync";
import { prettyDate } from "@/admin/lib/calc";
import { buildHrToday, hrTodaySyncLabel, openTasksDue, type HrTodayIssueKind } from "@/admin/lib/hr-today";
import { useEmployeeFinanceMock } from "@/admin/lib/employee-finance-mock";
import { useAdminNav, type AttFocus } from "@/admin/lib/admin-nav";
import { useHrReminders } from "@/admin/lib/hr-reminders";
import { useHrAuditHistory } from "@/admin/lib/hr-audit-history";
import { usePerfFollowUps } from "@/admin/lib/perf-followups";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import { SectionTitle, todayStr } from "./common";

const KIND_LABEL: Record<HrTodayIssueKind, string> = {
  missing: "Missing attendance",
  leave: "On leave",
  absent: "Absent",
  late: "Late (after grace)",
  early_out: "Early out",
  miss_punch: "Miss punch",
  review_note: "Needs review",
  low_leave_balance: "Low leave balance",
  bank_missing: "Bank incomplete",
};

const FILTERS: { id: "all" | HrTodayIssueKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "missing", label: "Missing" },
  { id: "review_note", label: "Review" },
  { id: "late", label: "Late" },
  { id: "leave", label: "Leave" },
  { id: "bank_missing", label: "Bank" },
  { id: "low_leave_balance", label: "Leave bal." },
];

/**
 * Full-page daily HR work center (Admin tab) — counterpart to Compliance “My Compliance Today”.
 */
export function MyHrToday({ localOnly = false }: { localOnly?: boolean }) {
  const [date, setDate] = useState(todayStr());
  const [filter, setFilter] = useState<"all" | HrTodayIssueKind>("all");
  const [remTitle, setRemTitle] = useState("");
  const [remDue, setRemDue] = useState(todayStr());
  const [remEmp, setRemEmp] = useState("");
  const [remMsg, setRemMsg] = useState("");
  const { employees, depts, records, settings, tasks } = useApp();
  const currentBanking = useEmployeeFinanceMock((s) => s.currentBanking);
  const ensureMeta = useEmployeeFinanceMock((s) => s.ensureMeta);
  const requestTab = useAdminNav((s) => s.requestTab);
  const requestAttendance = useAdminNav((s) => s.requestAttendance);
  const syncStatus = useSyncExternalStore(subscribeSync, getSyncStatus, () => "connecting" as const);
  // Select stable store slices — NEVER call dueOnOrBefore/openFollowUps inside the
  // zustand selector (they allocate a new array every getSnapshot → React #185
  // "Maximum update depth exceeded" after My HR Today first paint).
  const reminders = useHrReminders((s) => s.reminders);
  const addReminder = useHrReminders((s) => s.add);
  const completeReminder = useHrReminders((s) => s.complete);
  const recordAudit = useHrAuditHistory((s) => s.record);
  const followUps = usePerfFollowUps((s) => s.followUps);

  useEffect(() => {
    for (const e of employees) ensureMeta(e.id);
  }, [employees, ensureMeta]);

  const dueReminders = useMemo(
    () => reminders.filter((r) => r.status === "open" && r.due <= date),
    [reminders, date],
  );
  const openPerfFu = useMemo(
    () => followUps.filter((f) => f.status === "open" && f.due <= date),
    [followUps, date],
  );

  const bankMissingIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of employees) {
      if (!currentBanking(e.id)) ids.push(e.id);
    }
    return ids;
  }, [employees, currentBanking]);

  const summary = useMemo(
    () =>
      buildHrToday({
        date,
        employees,
        depts,
        records,
        settings,
        bankMissingIds,
      }),
    [date, employees, depts, records, settings, bankMissingIds],
  );

  const dueTasks = useMemo(() => openTasksDue(tasks, date), [tasks, date]);
  const syncLabel = hrTodaySyncLabel({
    previewIsolated: isPreviewIsolated(),
    localOnly,
    status: syncStatus,
  });

  const issues = filter === "all" ? summary.issues : summary.issues.filter((i) => i.kind === filter);

  const chips: { label: string; value: number; focus?: AttFocus; tab?: string }[] = [
    { label: "Entered", value: summary.entered, focus: "all" },
    { label: "Missing", value: summary.missing, focus: "missing" },
    { label: "On leave", value: summary.onLeave, focus: "leave" },
    { label: "Needs review", value: summary.needsReview, focus: "review" },
    { label: "Late after grace", value: summary.lateAfterGrace, focus: "review" },
    { label: "Bank incomplete", value: summary.bankMissing, tab: "directory" },
    { label: "Low leave bal.", value: summary.lowLeaveBalances, tab: "leave" },
    { label: "HR reminders due", value: dueReminders.length },
    { label: "Perf follow-ups", value: openPerfFu.length, tab: "performance" },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title="My HR Today"
        sub={`${prettyDate(date)} · Daily work center for attendance, leave, and bank completeness.`}
        right={
          <div className="admin-toolbar gap-2">
            <span className="chip bg-primary/10 font-semibold text-primary" title="Sync status (Batch 1 labels; #19 owns reconnect UX)">
              {syncLabel}
            </span>
            <input
              type="date"
              className="field w-auto"
              aria-label="Work date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
        }
      />

      <section className="panel space-y-2" aria-label="HR today summary">
        <h3 className="text-sm font-extrabold tracking-wide uppercase text-muted-foreground">Summary</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              className="admin-stat text-left transition hover:ring-2 hover:ring-primary/40"
              onClick={() => {
                if (c.tab) requestTab(c.tab);
                else if (c.focus) requestAttendance(c.focus);
              }}
            >
              <p className="admin-stat-label">{c.label}</p>
              <p className="admin-stat-value">{c.value}</p>
            </button>
          ))}
        </div>
      </section>

      {dueTasks.length > 0 && (
        <section className="panel space-y-1" aria-label="Open tasks">
          <h3 className="text-sm font-extrabold tracking-wide uppercase text-muted-foreground">Open tasks</h3>
          <ul className="text-sm">
            {dueTasks.map((t) => (
              <li key={t.id}>
                <button type="button" className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => requestTab("tasks")}>
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel space-y-3" aria-label="HR reminders">
        <h3 className="text-sm font-extrabold tracking-wide uppercase text-muted-foreground">HR Reminders</h3>
        <p className="text-sm text-muted-foreground">Desk reminders for My HR Today — not push or email.</p>
        <div className="admin-toolbar flex-wrap">
          <input
            className="field min-w-[160px] flex-1"
            placeholder="Reminder title"
            value={remTitle}
            onChange={(e) => setRemTitle(e.target.value)}
            aria-label="Reminder title"
          />
          <input type="date" className="field w-auto" value={remDue} onChange={(e) => e.target.value && setRemDue(e.target.value)} aria-label="Reminder due" />
          <select className="field w-auto" value={remEmp} onChange={(e) => setRemEmp(e.target.value)} aria-label="Reminder employee">
            <option value="">Optional employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const emp = employees.find((e) => e.id === remEmp);
              const r = addReminder({
                title: remTitle,
                due: remDue,
                ...(remEmp ? { employeeId: remEmp } : {}),
                ...(emp?.name ? { employeeName: emp.name } : {}),
              });
              if ("error" in r) {
                setRemMsg(r.error);
                return;
              }
              recordAudit({
                who: "HR",
                kind: "reminder_add",
                detail: `Reminder “${r.title}” due ${r.due}`,
                month: remDue.slice(0, 7),
                ...(r.employeeId ? { employeeId: r.employeeId } : {}),
              });
              setRemTitle("");
              setRemMsg("Reminder added.");
            }}
          >
            Add reminder
          </button>
        </div>
        {remMsg && <p className="text-sm text-primary">{remMsg}</p>}
        <ul className="space-y-2 text-sm">
          {dueReminders.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{r.title}</strong>
                {r.employeeName ? ` · ${r.employeeName}` : ""} · due {r.due}
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  completeReminder(r.id);
                  recordAudit({
                    who: "HR",
                    kind: "reminder_done",
                    detail: `Completed reminder “${r.title}”`,
                    month: r.due.slice(0, 7),
                    ...(r.employeeId ? { employeeId: r.employeeId } : {}),
                  });
                }}
              >
                Done
              </button>
            </li>
          ))}
          {!dueReminders.length && <li className="text-muted-foreground">No open reminders due on or before {prettyDate(date)}.</li>}
        </ul>
        {openPerfFu.length > 0 && (
          <p className="text-sm">
            <button type="button" className="font-semibold text-primary underline" onClick={() => requestTab("performance")}>
              {openPerfFu.length} performance follow-up{openPerfFu.length === 1 ? "" : "s"} due
            </button>
          </p>
        )}
      </section>

      <section className="space-y-2" aria-label="Work queue">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`tracker-filter-btn ${filter === f.id ? "tracker-filter-btn-on" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {issues.map((issue, idx) => (
            <article key={`${issue.kind}-${issue.employeeId}-${idx}`} className="admin-emp-card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{issue.name}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="chip mr-2 bg-muted/70">{KIND_LABEL[issue.kind]}</span>
                  {issue.detail}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => {
                  if (issue.openTab === "attendance") requestAttendance("review");
                  else requestTab(issue.openTab);
                }}
              >
                Open {issue.openTab === "directory" ? "Directory" : issue.openTab === "leave" ? "Leave" : "Attendance"}
              </button>
            </article>
          ))}
          {!issues.length && (
            <p className="panel text-sm text-muted-foreground">Nothing in this filter for {prettyDate(date)}.</p>
          )}
        </div>
      </section>
    </div>
  );
}
