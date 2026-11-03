import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { saveNow } from "@/admin/lib/cloud-sync";
import { calcDay, fmtHours, leaveBalance, monthDays, prettyDate } from "@/admin/lib/calc";
import { downloadPayrollCsv } from "@/admin/lib/reports";
import { emptyRec, type Status } from "@/admin/lib/types";
import { SectionTitle, TimeInput, Toggle, Tone } from "./common";
import { useWorkDate } from "@/admin/lib/workdate";

export function Attendance() {
  const { date, setDate } = useWorkDate();
  const [saveMsg, setSaveMsg] = useState("");
  const month = date.slice(0, 7);
  const monthSpan = useMemo(() => monthDays(month), [month]);
  const [rangeFrom, setRangeFrom] = useState(monthSpan[0] ?? `${month}-01`);
  const [rangeTo, setRangeTo] = useState(monthSpan[monthSpan.length - 1] ?? `${month}-01`);
  const { employees, depts, records, perf, settings, setRec, resetRec, resetDay } = useApp();
  const day = records[date] ?? {};
  const data = { depts, employees, records, perf, settings };

  useEffect(() => {
    setRangeFrom(monthSpan[0] ?? `${month}-01`);
    setRangeTo(monthSpan[monthSpan.length - 1] ?? `${month}-01`);
  }, [month, monthSpan]);

  const save = async () => {
    setSaveMsg("Saving…");
    const ok = await saveNow();
    setSaveMsg(ok ? `✓ Saved — ${prettyDate(date)} is now in reports` : "Save failed, try again");
    if (ok) setTimeout(() => setSaveMsg(""), 4000);
  };
  const saveBtn = (
    <div className="flex items-center gap-3">
      <button className="btn-primary px-6" onClick={() => void save()}>Save attendance</button>
      {saveMsg && <span className={`text-sm font-semibold ${saveMsg.startsWith("✓") ? "text-primary" : saveMsg.includes("failed") ? "text-destructive" : "text-muted-foreground"}`}>{saveMsg}</span>}
    </div>
  );

  return (
    <div>
      <SectionTitle
        title="Daily attendance"
        sub={`${prettyDate(date)} · Paste each time from the machine, then click Save.`}
        right={
          <div className="flex flex-wrap gap-2">
            <input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <input
              type="date"
              className="field w-auto"
              title="Payroll range from"
              value={rangeFrom}
              onChange={(e) => e.target.value && setRangeFrom(e.target.value)}
            />
            <span className="self-center text-sm text-muted-foreground">to</span>
            <input
              type="date"
              className="field w-auto"
              title="Payroll range to"
              value={rangeTo}
              onChange={(e) => e.target.value && setRangeTo(e.target.value)}
            />
            <button
              className="btn-ghost"
              onClick={() => downloadPayrollCsv(data, rangeFrom, rangeTo, rangeFrom.slice(0, 7))}
            >
              Export Payroll CSV
            </button>
            <button className="btn-primary" onClick={() => void save()}>Save</button>
            <button className="btn-danger" onClick={() => confirm(`Clear ALL records for ${prettyDate(date)}?`) && resetDay(date)}>
              Reset day
            </button>
          </div>
        }
      />

      {!employees.length && <p className="panel text-muted-foreground">Add your employees in the Team tab first.</p>}
      <div className="space-y-3">
        {employees.map((e, i) => {
          const dept = depts.find((d) => d.id === e.deptId);
          const rec = day[e.id];
          const r = rec ?? emptyRec();
          const c = calcDay(e, dept, date, r, settings);
          const set = (p: Partial<typeof r>) => setRec(date, e.id, p);
          const setStatus = (st: Status) => {
            if (st === "leave") {
              const bal = leaveBalance(e, date, records);
              const paid = bal >= 1 ? true : confirm(`${e.name} has ${bal} paid leave left.\n\nOK = mark as PAID leave\nCancel = mark as UNPAID leave`);
              set({ status: st, leavePaid: paid });
            } else set({ status: st });
          };
          const noBreakDay = c.isSat || r.noBreak;
          const timesOff = r.status === "leave" || r.status === "absent";
          return (
            <div key={e.id} className={`panel ${rec ? "" : "opacity-80"}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="mr-2 font-display text-muted-foreground">{i + 1}.</span>
                  <span className="font-bold">{e.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{dept?.name}</span>
                  {e.afterHours && <span className="chip ml-2 bg-secondary text-secondary-foreground">After-hours</span>}
                  {!rec && <span className="chip ml-2 bg-muted text-muted-foreground">Not entered</span>}
                  {!timesOff && r.in != null && r.out == null && (
                    <span className="chip ml-2 bg-amber-100 text-amber-800" title="Punch in is set but punch out is empty">
                      Missing Clock-Out
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select className="field w-auto" value={r.status} onChange={(ev) => setStatus(ev.target.value as Status)}>
                    <option value="present">Present</option>
                    <option value="half">Half day</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                  {rec && (
                    <button className="btn-ghost" onClick={() => confirm(`Reset ${e.name}'s record for this day?`) && resetRec(date, e.id)}>
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {r.status === "leave" && (
                <div className="mb-3 flex items-center gap-3 text-sm">
                  <Toggle checked={r.leavePaid} onChange={(v) => set({ leavePaid: v })} label="Paid leave" />
                  <span className="text-muted-foreground">Balance before this day: {leaveBalance(e, date, records)}</span>
                </div>
              )}

              {!timesOff && (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <TimeInput label="Punch in" value={r.in} onChange={(v) => set({ in: v })} />
                    <TimeInput label="Break in" value={r.bin} disabled={noBreakDay} onChange={(v) => set({ bin: v })} />
                    <TimeInput label="Break out" value={r.bout} disabled={noBreakDay} onChange={(v) => set({ bout: v })} />
                    <TimeInput label="Punch out" value={r.out} onChange={(v) => set({ out: v })} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                    {!c.isSat && <Toggle checked={r.noBreak} onChange={(v) => set({ noBreak: v })} label="No break taken" />}
                    {settings.overpay && !c.naturalExtraDay && (
                      <Toggle checked={!!r.extraMarked} onChange={(v) => set({ extraMarked: v })} label="Additional day" />
                    )}
                    {settings.overpay && e.afterHours && !c.naturalExtraDay && !r.extraMarked && !c.isSat && (
                      <Toggle checked={!!r.doubleShift} onChange={(v) => set({ doubleShift: v, otMarked: v ? false : r.otMarked })} label="Double shift (stayed for extra shift)" />
                    )}
                    {settings.overpay && !c.extraDay && (
                      <Toggle checked={r.otMarked} onChange={(v) => set({ otMarked: v })} label={c.isSat ? "Saturday overtime" : "Overtime"} />
                    )}
                    {r.otMarked && !c.extraDay && (
                      <span className="flex items-center gap-2 text-sm">
                        <select className="field h-9 w-auto" value={r.otMode} onChange={(ev) => set({ otMode: ev.target.value as "auto" | "custom" })}>
                          <option value="auto">Auto from shift</option>
                          <option value="custom">Custom hours</option>
                        </select>
                        {r.otMode === "custom" && (
                          <input type="number" step="0.25" min="0" className="field h-9 w-24" value={r.otHours} onChange={(ev) => set({ otHours: +ev.target.value })} />
                        )}
                      </span>
                    )}
                    {c.extraDay && settings.overpay && (
                      <span className="flex items-center gap-2 text-sm">
                        Additional day hours
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          placeholder={c.worked != null ? fmtHours(c.worked) : "auto"}
                          className="field h-9 w-24"
                          value={r.extraHours ?? ""}
                          onChange={(ev) => set({ extraHours: ev.target.value === "" ? null : +ev.target.value })}
                        />
                      </span>
                    )}
                  </div>
                  {r.status === "half" && (
                    <input className="field mt-3" placeholder="Half day reason" value={r.halfReason} onChange={(ev) => set({ halfReason: ev.target.value })} />
                  )}
                </>
              )}

              <textarea
                className="field mt-3 h-16 py-2"
                placeholder="Note / reason (e.g. informed HR about late arrival)"
                value={r.note}
                onChange={(ev) => set({ note: ev.target.value })}
              />

              {rec && (() => {
                const tips: string[] = [];
                if (c.missPunch) tips.push(`Missing ${c.missing.length} punch(es) — paste them from the machine or add a note.`);
                if (r.in != null && r.out == null) tips.push("Missing clock-out — paste punch out from the machine or add a note.");
                if (e.afterHours && !r.doubleShift && !c.extraDay && c.worked != null && c.worked >= c.shiftLen + 120)
                  tips.push(`Worked ${fmtHours(c.worked)} h — more than a normal shift. Tick "Double shift" if he stayed for an extra shift.`);
                if (!r.doubleShift && c.worked != null && c.worked > 16 * 60)
                  tips.push(`Shift duration ${fmtHours(c.worked)} h (>16 h) without double-shift flagged — tick "Double shift" if this was an extra shift.`);
                if (c.lateLevel === "late" && !r.note) tips.push("Late arrival — add a reason in the note.");
                if (c.breakLevel === "over" && !r.note) tips.push("Break over limit — add a reason in the note.");
                return tips.length ? (
                  <ul className="mt-3 space-y-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    {tips.map((t) => <li key={t}>💡 {t}</li>)}
                  </ul>
                ) : null;
              })()}

              {rec && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
                  <span>
                    Worked: <b>{c.worked != null ? `${fmtHours(c.worked)} h` : "—"}</b>
                  </span>
                  {c.breakTaken != null && <span>Break: <b>{c.breakTaken}m</b></span>}
                  {c.flags.length ? (
                    c.flags.map((f) => (
                      <Tone key={f} tone={c.violations.includes(f) || f.startsWith("Miss") ? "red" : undefined}>
                        {f}
                      </Tone>
                    ))
                  ) : (
                    <Tone tone="green">On time</Tone>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {employees.length > 0 && <div className="panel mt-4 flex justify-end">{saveBtn}</div>}
    </div>
  );
}
