import { useState } from "react";
import { useApp } from "@/admin/lib/store";
import { calcDay, fmtHours, monthDays, prettyDate } from "@/admin/lib/calc";
import { SectionTitle, todayStr } from "./common";
import { missedDaily } from "./Tasks";

export function Overview() {
  const [date, setDate] = useState(todayStr());
  const { employees, depts, records, settings, tasks } = useApp();
  const rows = employees.filter((e) => records[date]?.[e.id]).map((e) => calcDay(e, depts.find((d) => d.id === e.deptId), date, records[date]![e.id]!, settings));
  const month = date.slice(0, 7);
  let ot = 0, extra = 0;
  employees.forEach((e) =>
    monthDays(month).forEach((d) => {
      const r = records[d]?.[e.id];
      if (!r) return;
      const c = calcDay(e, depts.find((x) => x.id === e.deptId), d, r, settings);
      ot += c.overtimeMin;
      if (c.extraDay) extra++;
    }),
  );
  const stats = [
    ["Entered", `${rows.length}/${employees.length}`],
    ["Late (after grace)", rows.filter((c) => c.lateLevel === "late").length],
    ["Under grace", rows.filter((c) => c.lateLevel === "grace").length],
    ["Over break", rows.filter((c) => c.breakLevel === "over").length],
    ["Miss punch", rows.filter((c) => c.missPunch).length],
    ["Month over time hours", fmtHours(ot)],
    ["Month extra days", extra],
  ];
  const missed = missedDaily(tasks);
  return (
    <div className="space-y-4">
      <SectionTitle title="Overview" sub={prettyDate(date)} right={<input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />} />
      {missed.length > 0 && <div className="panel mb-1 text-sm font-semibold text-destructive">Daily tasks missed yesterday: {missed.map((t) => t.title).join(", ")}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="admin-stat">
            <p className="admin-stat-label">{k}</p>
            <p className="admin-stat-value">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
