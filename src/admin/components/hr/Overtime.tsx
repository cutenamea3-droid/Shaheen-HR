import { useState } from "react";
import { useApp } from "@/admin/lib/store";
import { calcDay, fmtHours, monthDays, prettyDate } from "@/admin/lib/calc";
import { SectionTitle, todayStr } from "./common";

type Row = { d: string; kind: "Overtime" | "Additional day"; min: number; note: string };

export function Overtime() {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [dept, setDept] = useState("");
  const { employees, depts, records, settings } = useApp();
  const list = employees
    .map((e, i) => {
      const rows: Row[] = [];
      monthDays(month).forEach((d) => {
        const r = records[d]?.[e.id];
        if (!r) return;
        const c = calcDay(e, depts.find((x) => x.id === e.deptId), d, r, settings);
        if (c.overtimeMin > 0) rows.push({ d, kind: "Overtime", min: c.overtimeMin, note: r.note ?? "" });
        if (c.extraDay) rows.push({ d, kind: "Additional day", min: c.extraDayMin, note: r.note ?? "" });
      });
      const ot = rows.filter((x) => x.kind === "Overtime").reduce((a, x) => a + x.min, 0);
      const ex = rows.filter((x) => x.kind === "Additional day");
      return { e, n: i + 1, rows, ot, exDays: ex.length, exMin: ex.reduce((a, x) => a + x.min, 0) };
    })
    .filter((x) => (!dept || x.e.deptId === dept) && x.rows.length);
  const tot = list.reduce((a, x) => ({ ot: a.ot + x.ot, d: a.d + x.exDays, m: a.m + x.exMin }), { ot: 0, d: 0, m: 0 });

  return (
    <div>
      <SectionTitle
        title="Overtime & Additional Days"
        sub={settings.overpay ? "Only overtime you marked in Attendance is counted" : "Over pay is turned off in Settings"}
        right={
          <div className="flex gap-2">
            <select className="field w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="month" className="field w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Employees", list.length], ["Overtime hours", fmtHours(tot.ot)], ["Additional days", tot.d], ["Additional day hours", fmtHours(tot.m)]].map(([k, v]) => (
          <div key={k} className="admin-stat"><p className="admin-stat-label">{k}</p><p className="admin-stat-value">{v}</p></div>
        ))}
      </div>
      {list.length === 0 && <div className="panel text-sm text-muted-foreground">No overtime or additional days this month.</div>}
      <div className="space-y-3">
        {list.map((x) => (
          <div key={x.e.id} className="admin-emp-card">
            <div className="admin-emp-head">
              <h3 className="font-bold tracking-tight">{x.n}. {x.e.name} <span className="text-sm font-normal text-muted-foreground">· {depts.find((d) => d.id === x.e.deptId)?.name} · {x.e.afterHours ? "After-hours" : "Normal"}</span></h3>
              <p className="text-sm">Over time <b>{fmtHours(x.ot)} h</b> · Additional <b>{x.exDays} day(s) / {fmtHours(x.exMin)} h</b></p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead className="admin-thead-sticky">
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Hours</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {x.rows.map((r, i) => (
                    <tr key={i}><td>{prettyDate(r.d)}</td><td>{r.kind}</td><td>{fmtHours(r.min)}</td><td className="whitespace-pre-wrap">{r.note || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
