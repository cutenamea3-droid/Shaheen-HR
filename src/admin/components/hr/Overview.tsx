import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { calcDay, fmtHours, monthDays, prettyDate } from "@/admin/lib/calc";
import { useAdminNav, type AttFocus } from "@/admin/lib/admin-nav";
import { useDensity, setDensity } from "@/lib/density";
import type { DayRec, Dept, Employee, Settings } from "@/admin/lib/types";
import { SectionTitle, todayStr } from "./common";
import { missedDaily } from "./Tasks";

/** Day rollup from existing attendance records only — no new persistence. */
function dayRollup(
  employees: Employee[],
  depts: Dept[],
  records: Record<string, Record<string, DayRec>>,
  settings: Settings,
  date: string,
) {
  let active = 0;
  let leave = 0;
  let inactive = 0;
  let missing = 0;
  let review = 0;
  const day = records[date] ?? {};
  for (const e of employees) {
    const rec = day[e.id];
    if (!rec) {
      missing++;
      continue;
    }
    if (rec.status === "leave") leave++;
    else if (rec.status === "absent") inactive++;
    else active++; // present | half
    const dept = depts.find((d) => d.id === e.deptId);
    const c = calcDay(e, dept, date, rec, settings);
    const needsReview =
      c.missPunch ||
      (rec.in != null && rec.out == null) ||
      (c.lateLevel === "late" && !rec.note) ||
      (c.breakLevel === "over" && !rec.note);
    if (needsReview) review++;
  }
  return { active, leave, inactive, missing, review, total: employees.length };
}

export function Overview() {
  const [date, setDate] = useState(todayStr());
  const { employees, depts, records, settings, tasks } = useApp();
  const density = useDensity();
  const requestAttendance = useAdminNav((s) => s.requestAttendance);
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
  const rollup = useMemo(
    () => dayRollup(employees, depts, records, settings, date),
    [employees, depts, records, settings, date],
  );
  const summary: { id: AttFocus; label: string; value: number; hint: string }[] = [
    { id: "active", label: "Active (present/half)", value: rollup.active, hint: "Open Attendance · present & half-day" },
    { id: "inactive", label: "Inactive (absent)", value: rollup.inactive, hint: "Open Attendance · absent" },
    { id: "leave", label: "On leave", value: rollup.leave, hint: "Open Attendance · leave" },
    { id: "missing", label: "Missing attendance", value: rollup.missing, hint: "Open Attendance · not entered" },
    { id: "review", label: "Needs review", value: rollup.review, hint: "Miss punch, missing out, late/break without note" },
  ];
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
      <SectionTitle
        title="Overview"
        sub={prettyDate(date)}
        right={
          <div className="admin-toolbar gap-2">
            <button
              type="button"
              className={`btn-ghost ${density === "compact" ? "ring-2 ring-primary" : ""}`}
              title="Compact packs attendance cards; Comfortable keeps them open"
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            >
              {density === "compact" ? "Compact" : "Comfortable"}
            </button>
            <input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
        }
      />
      {missed.length > 0 && <div className="panel mb-1 text-sm font-semibold text-destructive">Daily tasks missed yesterday: {missed.map((t) => t.title).join(", ")}</div>}

      <section className="panel space-y-2" aria-label="HR daily summary">
        <div>
          <h3 className="text-sm font-extrabold tracking-wide uppercase text-muted-foreground">Daily summary</h3>
          <p className="text-sm text-muted-foreground">Existing attendance only — tap a chip to open Attendance with that filter.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {summary.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              onClick={() => requestAttendance(s.id)}
              className="admin-stat text-left transition hover:ring-2 hover:ring-primary/40"
            >
              <p className="admin-stat-label">{s.label}</p>
              <p className="admin-stat-value">{s.value}</p>
            </button>
          ))}
        </div>
      </section>

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
