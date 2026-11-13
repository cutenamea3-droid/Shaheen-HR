import { useState } from "react";
import { useApp } from "@/admin/lib/store";
import { fmtTime, leaveBalance } from "@/admin/lib/calc";
import { normalizeAssignments } from "@/admin/lib/shift-assignment";
import { SectionTitle, Toggle, todayStr } from "./common";

export function Team() {
  const { employees, depts, records, addEmployee, updateEmployee, removeEmployee, moveEmployee } = useApp();
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState(depts[0]?.id ?? "");
  const [after, setAfter] = useState(false);
  const [deptEffectiveFrom, setDeptEffectiveFrom] = useState(todayStr());

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Team"
        sub="Employee profiles — order here is the order in every report. Department changes keep historical shift effective dates for Late/Early."
      />
      <form
        className="admin-emp-card mb-1 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addEmployee({
            name: name.trim(),
            deptId,
            afterHours: after,
            joinMonth: todayStr().slice(0, 7),
            openingLeave: 0,
          });
          setName("");
          setAfter(false);
        }}
      >
        <label>
          <span className="lbl">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="lbl">Department</span>
          <select className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({fmtTime(d.start)}–{fmtTime(d.end)})
              </option>
            ))}
          </select>
        </label>
        <Toggle checked={after} onChange={setAfter} label="After-hours (overnight)" />
        <button type="submit" className="btn-primary">
          Add employee
        </button>
      </form>

      <div className="admin-toolbar gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="lbl mb-0">Dept change effective</span>
          <input
            type="date"
            className="field w-auto"
            value={deptEffectiveFrom}
            onChange={(e) => e.target.value && setDeptEffectiveFrom(e.target.value)}
            title="Applied when you change an employee's department below"
          />
        </label>
      </div>

      <div className="space-y-2">
        {employees.map((e, i) => {
          const dept = depts.find((d) => d.id === e.deptId);
          const hist = normalizeAssignments(e);
          const bal = leaveBalance(e, todayStr(), records);
          return (
            <div key={e.id} className="admin-emp-card space-y-3">
              <div className="grid gap-3 md:grid-cols-[80px_1fr_1fr_auto_120px_110px_auto] md:items-end">
                <label>
                  <span className="lbl">No.</span>
                  <input
                    type="number"
                    min={1}
                    max={employees.length}
                    className="field"
                    value={i + 1}
                    onChange={(ev) => moveEmployee(e.id, +ev.target.value - 1)}
                  />
                </label>
                <label>
                  <span className="lbl">Name</span>
                  <input
                    className="field"
                    value={e.name}
                    onChange={(ev) => updateEmployee(e.id, { name: ev.target.value })}
                  />
                </label>
                <label>
                  <span className="lbl">Department (shift)</span>
                  <select
                    className="field"
                    value={e.deptId}
                    onChange={(ev) =>
                      updateEmployee(e.id, {
                        deptId: ev.target.value,
                        deptEffectiveFrom,
                      })
                    }
                  >
                    {depts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Toggle
                  checked={e.afterHours}
                  onChange={(v) => updateEmployee(e.id, { afterHours: v })}
                  label="After-hours"
                />
                <label>
                  <span className="lbl">Leave from</span>
                  <input
                    type="month"
                    className="field"
                    value={e.joinMonth}
                    onChange={(ev) => ev.target.value && updateEmployee(e.id, { joinMonth: ev.target.value })}
                  />
                </label>
                <label>
                  <span className="lbl">Saved leaves</span>
                  <input
                    type="number"
                    min={0}
                    className="field"
                    value={e.openingLeave}
                    onChange={(ev) => updateEmployee(e.id, { openingLeave: +ev.target.value })}
                  />
                </label>
                <div className="admin-toolbar gap-1">
                  <button
                    type="button"
                    className="btn-ghost px-3"
                    disabled={i === 0}
                    onClick={() => moveEmployee(e.id, i - 1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3"
                    disabled={i === employees.length - 1}
                    onClick={() => moveEmployee(e.id, i + 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-danger px-3"
                    onClick={() => confirm(`Remove ${e.name}?`) && removeEmployee(e.id)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  Current shift:{" "}
                  <strong className="text-foreground">
                    {dept ? `${dept.name} ${fmtTime(dept.start)}–${fmtTime(dept.end)}` : "Not configured"}
                  </strong>
                </span>
                <span>
                  Paid leave balance today: <strong className="text-foreground">{bal}</strong>
                </span>
                <span title="Preserved for Late/Early on past dates">
                  Shift history:{" "}
                  {hist
                    .map((a) => {
                      const d = depts.find((x) => x.id === a.deptId);
                      return `${a.effectiveFrom}→${d?.name ?? a.deptId}`;
                    })
                    .join(" · ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
