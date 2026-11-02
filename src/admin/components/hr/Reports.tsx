import { useState } from "react";
import { useApp } from "@/admin/lib/store";
import {
  dailyAttendance, dailyCombined, dailyPerformance, downloadCsv, downloadPdf,
  monthlyAttendance, monthlyOvertime, monthlyPerformance, type Table,
} from "@/admin/lib/reports";
import { SectionTitle, todayStr } from "./common";

function Card({ title, sub, make, name }: { title: string; sub: string; make: () => Table[]; name: string }) {
  const company = useApp((s) => s.settings.company);
  return (
    <div className="panel flex flex-col justify-between gap-3">
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => void downloadPdf(make(), company, `${name}.pdf`)}>PDF</button>
        <button className="btn-ghost" onClick={() => downloadCsv(make(), `${name}.csv`)}>CSV</button>
      </div>
    </div>
  );
}

export function Reports() {
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const s = useApp();
  const data = { depts: s.depts, employees: s.employees, records: s.records, perf: s.perf, settings: s.settings };
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="CEO daily reports" sub="Bordered tables, violations printed in red." right={<input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />} />
        <div className="grid gap-3 md:grid-cols-3">
          <Card title="Combined daily" sub="Attendance + performance in one sheet" make={() => [dailyCombined(data, date)]} name={`daily-combined-${date}`} />
          <Card title="Daily attendance" sub="Punches, breaks, hours, remarks, notes" make={() => [dailyAttendance(data, date)]} name={`daily-attendance-${date}`} />
          <Card title="Daily performance" sub="Ratings, violations and notes" make={() => [dailyPerformance(data, date)]} name={`daily-performance-${date}`} />
        </div>
      </section>
      <section>
        <SectionTitle title="Monthly reports" right={<input type="month" className="field w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />} />
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Combined monthly" sub="Attendance, performance and overtime together" make={() => [...monthlyAttendance(data, month), ...monthlyPerformance(data, month), ...monthlyOvertime(data, month)]} name={`monthly-combined-${month}`} />
          <Card title="Monthly attendance" sub="Days, hours, late, over break, miss punches, leaves, notes" make={() => monthlyAttendance(data, month)} name={`monthly-attendance-${month}`} />
          <Card title="Monthly performance" sub="Rating counts, violation days, notes" make={() => monthlyPerformance(data, month)} name={`monthly-performance-${month}`} />
          <Card title="Overtime & additional days" sub="Overtime hours and extra Saturdays/Sundays" make={() => monthlyOvertime(data, month)} name={`monthly-overtime-${month}`} />
        </div>
      </section>
    </div>
  );
}
