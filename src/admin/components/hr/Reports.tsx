import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { monthDays } from "@/admin/lib/calc";
import {
  dailyAttendance, dailyCombined, dailyPerformance, downloadCsv, downloadPdf, downloadPayrollCsv,
  monthlyAttendance, monthlyOvertime, monthlyPerformance, type Table,
} from "@/admin/lib/reports";
import { downloadMonthlyPdf, type MonthlyPdfMode } from "@/admin/lib/monthly-pdf";
import { downloadEmployeeReportPdf } from "@/admin/lib/employee-report-pdf";
import { useMonthClosing } from "@/admin/lib/month-closing";
import { useHrAuditHistory } from "@/admin/lib/hr-audit-history";
import { SectionTitle, todayStr } from "./common";

function Card({ title, sub, make, name }: { title: string; sub: string; make: () => Table[]; name: string }) {
  const company = useApp((s) => s.settings.company);
  return (
    <div className="admin-emp-card flex flex-col justify-between gap-3">
      <div>
        <h3 className="font-bold tracking-tight">{title}</h3>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{sub}</p>
      </div>
      <div className="admin-toolbar">
        <button type="button" className="btn-primary" onClick={() => void downloadPdf(make(), company, `${name}.pdf`)}>PDF</button>
        <button type="button" className="btn-ghost" onClick={() => downloadCsv(make(), `${name}.csv`)}>CSV</button>
      </div>
    </div>
  );
}

export function Reports() {
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const days = useMemo(() => monthDays(month), [month]);
  const [from, setFrom] = useState(days[0] ?? `${month}-01`);
  const [to, setTo] = useState(days[days.length - 1] ?? `${month}-01`);
  const [empId, setEmpId] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [closeMsg, setCloseMsg] = useState("");
  const s = useApp();
  const data = { depts: s.depts, employees: s.employees, records: s.records, perf: s.perf, settings: s.settings };
  const company = s.settings.company;
  const closeMonth = useMonthClosing((st) => st.closeMonth);
  const reopenMonth = useMonthClosing((st) => st.reopenMonth);
  const isClosed = useMonthClosing((st) => st.isClosed(month));
  const monthRec = useMonthClosing((st) => st.months[month]);
  const recordAudit = useHrAuditHistory((st) => st.record);
  const who = "HR";

  const onMonthChange = (m: string) => {
    if (!m) return;
    setMonth(m);
    const md = monthDays(m);
    setFrom(md[0]!);
    setTo(md[md.length - 1]!);
    setCloseMsg("");
  };

  const exportMonthly = (mode: MonthlyPdfMode) => {
    void downloadMonthlyPdf(data, { mode, company, month });
    recordAudit({
      who,
      kind: mode === "management" ? "pdf_management" : "pdf_audit",
      detail: `${mode === "management" ? "Management Summary" : "Full HR Audit"} exported for ${month}`,
      month,
    });
  };

  const exportEmployee = () => {
    if (!empId) {
      setCloseMsg("Select an employee for the individual report.");
      return;
    }
    void downloadEmployeeReportPdf(data, { company, month, employeeId: empId });
    recordAudit({
      who,
      kind: "pdf_employee",
      detail: `Individual employee report exported for ${month}`,
      month,
      employeeId: empId,
    });
  };

  const onClose = () => {
    const r = closeMonth(month, who);
    if (!r.ok) {
      setCloseMsg(r.error);
      return;
    }
    recordAudit({ who, kind: "month_close", detail: `Closed ${month} (Closing ≠ Paid)`, month });
    setCloseMsg(`Month ${month} closed. Closing does not mark salary Paid.`);
  };

  const onReopen = () => {
    const r = reopenMonth(month, who, reopenReason);
    if (!r.ok) {
      setCloseMsg(r.error);
      return;
    }
    recordAudit({
      who,
      kind: "month_reopen",
      detail: `Reopened ${month}: ${reopenReason.trim()}`,
      month,
    });
    setReopenReason("");
    setCloseMsg(`Month ${month} reopened.`);
  };

  return (
    <div className="space-y-8">
      <section className="admin-emp-card space-y-3">
        <SectionTitle
          title="Monthly closing"
          sub="Close locks the attendance period for reporting. Closing ≠ Paid — salary payment status is never changed here."
          right={<input type="month" className="field w-auto" aria-label="Close month" value={month} onChange={(e) => onMonthChange(e.target.value)} />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip font-semibold ${isClosed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {isClosed ? "Closed" : "Open"}
          </span>
          {!isClosed ? (
            <button type="button" className="btn-primary" onClick={onClose}>
              Close month
            </button>
          ) : (
            <>
              <input
                className="field min-w-[220px] flex-1"
                placeholder="Reopen reason (required)"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                aria-label="Reopen reason"
              />
              <button type="button" className="btn-ghost" onClick={onReopen}>
                Reopen month
              </button>
            </>
          )}
        </div>
        {monthRec?.closedAt && (
          <p className="text-sm text-muted-foreground">
            Closed by {monthRec.closedBy} · {new Date(monthRec.closedAt).toLocaleString()}
            {monthRec.reopenReason ? ` · Last reopen: ${monthRec.reopenReason}` : ""}
          </p>
        )}
        {closeMsg && <p className="text-sm font-medium text-primary">{closeMsg}</p>}
      </section>

      <section className="admin-emp-card space-y-1">
        <SectionTitle
          title="Payroll export"
          sub="Summary CSV for the selected date range (reuses attendance calc rules — formulas unchanged). Hours only — no bank/IBAN."
          right={
            <>
              <input type="month" className="field w-auto" aria-label="Payroll month" value={month} onChange={(e) => onMonthChange(e.target.value)} />
              <input type="date" className="field w-auto" aria-label="Payroll range from" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
              <span className="text-sm text-muted-foreground" aria-hidden>
                to
              </span>
              <input type="date" className="field w-auto" aria-label="Payroll range to" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
              <button
                type="button"
                className="btn-primary"
                onClick={() => downloadPayrollCsv(data, from, to, from.slice(0, 7))}
              >
                Export Payroll CSV
              </button>
            </>
          }
        />
      </section>
      <section>
        <SectionTitle title="CEO daily reports" sub="Bordered tables, violations printed in red." right={<input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />} />
        <div className="grid gap-3 md:grid-cols-3">
          <Card title="Combined daily" sub="Attendance + performance in one sheet" make={() => [dailyCombined(data, date)]} name={`daily-combined-${date}`} />
          <Card title="Daily attendance" sub="Punches, breaks, hours, remarks, notes" make={() => [dailyAttendance(data, date)]} name={`daily-attendance-${date}`} />
          <Card title="Daily performance" sub="Ratings, violations and notes" make={() => [dailyPerformance(data, date)]} name={`daily-performance-${date}`} />
        </div>
      </section>
      <section>
        <SectionTitle
          title="Monthly reports"
          sub="Premium Shaheen Transport LLC PDF (forest green / gold). Portal UI stays navy/orange. Management Summary for leadership; Full HR Audit includes sensitive note text."
          right={<input type="month" className="field w-auto" value={month} onChange={(e) => onMonthChange(e.target.value)} aria-label="Report month" />}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="admin-emp-card flex flex-col justify-between gap-3 md:col-span-2">
            <div>
              <h3 className="font-bold tracking-tight">Monthly Combined PDF</h3>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                Sections A–F from the selected month. Same verified attendance calculations; no bank/IBAN; no invented signatures.
              </p>
            </div>
            <div className="admin-toolbar flex-wrap">
              <button type="button" className="btn-primary" onClick={() => exportMonthly("management")}>
                Management Summary PDF
              </button>
              <button type="button" className="btn-primary" onClick={() => exportMonthly("audit")}>
                Full HR Audit PDF
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  downloadCsv(
                    [...monthlyAttendance(data, month), ...monthlyPerformance(data, month), ...monthlyOvertime(data, month)],
                    `monthly-combined-${month}.csv`,
                  )
                }
              >
                Combined CSV
              </button>
            </div>
          </div>

          <div className="admin-emp-card flex flex-col justify-between gap-3 md:col-span-2">
            <div>
              <h3 className="font-bold tracking-tight">Individual Employee Report</h3>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                One employee, selected month — attendance facts, statements, and assessment ratings. No banking or salary.
              </p>
            </div>
            <div className="admin-toolbar flex-wrap">
              <select
                className="field w-auto min-w-[200px]"
                aria-label="Employee for report"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
              >
                <option value="">Select employee</option>
                {s.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-primary" onClick={exportEmployee}>
                Employee Report PDF
              </button>
            </div>
          </div>

          <Card title="Monthly attendance" sub="Days, hours, late, over break, miss punches, leaves, notes" make={() => monthlyAttendance(data, month)} name={`monthly-attendance-${month}`} />
          <Card title="Monthly performance" sub="Rating counts, violation days, notes" make={() => monthlyPerformance(data, month)} name={`monthly-performance-${month}`} />
          <Card title="Overtime & additional days" sub="Overtime hours and extra Saturdays/Sundays" make={() => monthlyOvertime(data, month)} name={`monthly-overtime-${month}`} />
        </div>
      </section>
    </div>
  );
}
