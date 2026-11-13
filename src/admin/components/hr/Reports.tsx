import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { monthDays } from "@/admin/lib/calc";
import {
  dailyAttendance, dailyCombined, dailyPerformance, downloadCsv, downloadPdf, downloadPayrollCsv,
  monthlyAttendance, monthlyOvertime, monthlyPerformance, type Table,
} from "@/admin/lib/reports";
import { downloadMonthlyPdf, type MonthlyPdfMode } from "@/admin/lib/monthly-pdf";
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
  const s = useApp();
  const data = { depts: s.depts, employees: s.employees, records: s.records, perf: s.perf, settings: s.settings };
  const company = s.settings.company;

  const onMonthChange = (m: string) => {
    if (!m) return;
    setMonth(m);
    const md = monthDays(m);
    setFrom(md[0]!);
    setTo(md[md.length - 1]!);
  };

  const exportMonthly = (mode: MonthlyPdfMode) => {
    void downloadMonthlyPdf(data, { mode, company, month });
  };

  return (
    <div className="space-y-8">
      <section className="admin-emp-card space-y-1">
        <SectionTitle
          title="Payroll export"
          sub="Summary CSV for the selected date range (reuses attendance calc rules — formulas unchanged)."
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
          sub="Premium Shaheen Transport LLC PDF from live selected-month data. Management Summary for leadership; Full HR Audit includes sensitive note text."
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
          <Card title="Monthly attendance" sub="Days, hours, late, over break, miss punches, leaves, notes" make={() => monthlyAttendance(data, month)} name={`monthly-attendance-${month}`} />
          <Card title="Monthly performance" sub="Rating counts, violation days, notes" make={() => monthlyPerformance(data, month)} name={`monthly-performance-${month}`} />
          <Card title="Overtime & additional days" sub="Overtime hours and extra Saturdays/Sundays" make={() => monthlyOvertime(data, month)} name={`monthly-overtime-${month}`} />
        </div>
      </section>
    </div>
  );
}
