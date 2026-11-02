import { useState } from "react";
import { useApp } from "@/admin/lib/store";
import { fmtTime } from "@/admin/lib/calc";
import { SectionTitle, Toggle, todayStr } from "./common";

export function Team() {
  const { employees, depts, addEmployee, updateEmployee, removeEmployee, moveEmployee } = useApp();
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState(depts[0]?.id ?? "");
  const [after, setAfter] = useState(false);
  return (
    <div>
      <SectionTitle title="Team" sub="Order here is the order in every report. Use the number box or arrows to move." />
      <form
        className="panel mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addEmployee({ name: name.trim(), deptId, afterHours: after, joinMonth: todayStr().slice(0, 7), openingLeave: 0 });
          setName("");
          setAfter(false);
        }}
      >
        <label><span className="lbl">Name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>
          <span className="lbl">Department</span>
          <select className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name} ({fmtTime(d.start)}–{fmtTime(d.end)})</option>)}
          </select>
        </label>
        <Toggle checked={after} onChange={setAfter} label="After-hours (overnight)" />
        <button className="btn-primary">Add employee</button>
      </form>
      <div className="space-y-2">
        {employees.map((e, i) => (
          <div key={e.id} className="panel grid gap-3 md:grid-cols-[80px_1fr_1fr_auto_120px_110px_auto] md:items-end">
            <label>
              <span className="lbl">No.</span>
              <input type="number" min={1} max={employees.length} className="field" value={i + 1} onChange={(ev) => moveEmployee(e.id, +ev.target.value - 1)} />
            </label>
            <label><span className="lbl">Name</span><input className="field" value={e.name} onChange={(ev) => updateEmployee(e.id, { name: ev.target.value })} /></label>
            <label>
              <span className="lbl">Department</span>
              <select className="field" value={e.deptId} onChange={(ev) => updateEmployee(e.id, { deptId: ev.target.value })}>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <Toggle checked={e.afterHours} onChange={(v) => updateEmployee(e.id, { afterHours: v })} label="After-hours" />
            <label><span className="lbl">Leave from</span><input type="month" className="field" value={e.joinMonth} onChange={(ev) => ev.target.value && updateEmployee(e.id, { joinMonth: ev.target.value })} /></label>
            <label><span className="lbl">Saved leaves</span><input type="number" min={0} className="field" value={e.openingLeave} onChange={(ev) => updateEmployee(e.id, { openingLeave: +ev.target.value })} /></label>
            <div className="flex gap-1">
              <button className="btn-ghost px-3" disabled={i === 0} onClick={() => moveEmployee(e.id, i - 1)} aria-label="Move up">↑</button>
              <button className="btn-ghost px-3" disabled={i === employees.length - 1} onClick={() => moveEmployee(e.id, i + 1)} aria-label="Move down">↓</button>
              <button className="btn-danger px-3" onClick={() => confirm(`Remove ${e.name}?`) && removeEmployee(e.id)} aria-label="Remove">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
