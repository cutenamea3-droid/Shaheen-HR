import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/admin/lib/store";
import { saveNow } from "@/admin/lib/cloud-sync";
import { calcDay, fmtHours, leaveBalance, monthDays, prettyDate } from "@/admin/lib/calc";
import { downloadPayrollCsv } from "@/admin/lib/reports";
import { resolveDeptAsOf } from "@/admin/lib/shift-assignment";
import { shiftVariance } from "@/admin/lib/shift-variance";
import { isDateInClosedMonth, useMonthClosing } from "@/admin/lib/month-closing";
import { emptyRec, type Status } from "@/admin/lib/types";
import { useAdminNav, type AttFocus } from "@/admin/lib/admin-nav";
import { useDensity, setDensity } from "@/lib/density";
import { loadAttendancePrefs, saveAttendancePrefs } from "@/lib/uiprefs";
import { SectionTitle, TimeInput, Toggle, Tone } from "./common";
import { useWorkDate } from "@/admin/lib/workdate";

function needsReview(
  e: { afterHours: boolean },
  r: ReturnType<typeof emptyRec>,
  c: ReturnType<typeof calcDay>,
): boolean {
  if (c.missPunch) return true;
  if (r.in != null && r.out == null) return true;
  if (c.lateLevel === "late" && !r.note) return true;
  if (c.breakLevel === "over" && !r.note) return true;
  if (e.afterHours && !r.doubleShift && !c.extraDay && c.worked != null && c.worked >= c.shiftLen + 120) return true;
  if (!r.doubleShift && c.worked != null && c.worked > 16 * 60) return true;
  return false;
}

const FOCUS_CHIPS: { id: AttFocus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "leave", label: "Leave" },
  { id: "inactive", label: "Absent" },
  { id: "missing", label: "Missing" },
  { id: "review", label: "Review" },
];

export function Attendance() {
  const { date, setDate } = useWorkDate();
  const [saveMsg, setSaveMsg] = useState("");
  const month = date.slice(0, 7);
  const monthSpan = useMemo(() => monthDays(month), [month]);
  const [rangeFrom, setRangeFrom] = useState(monthSpan[0] ?? `${month}-01`);
  const [rangeTo, setRangeTo] = useState(monthSpan[monthSpan.length - 1] ?? `${month}-01`);
  const { employees, depts, records, perf, settings, setRec, resetRec, resetDay } = useApp();
  const isClosedFn = useMonthClosing((s) => s.isClosed);
  const monthClosed = isDateInClosedMonth(date, isClosedFn);
  const day = records[date] ?? {};
  const data = { depts, employees, records, perf, settings };
  const density = useDensity();
  const attFocus = useAdminNav((s) => s.attFocus);
  const setAttFocus = useAdminNav((s) => s.setAttFocus);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => loadAttendancePrefs().expanded ?? {});

  useEffect(() => {
    const p = loadAttendancePrefs();
    if (p.focus) setAttFocus(p.focus);
  }, [setAttFocus]);

  useEffect(() => {
    setRangeFrom(monthSpan[0] ?? `${month}-01`);
    setRangeTo(monthSpan[monthSpan.length - 1] ?? `${month}-01`);
  }, [month, monthSpan]);

  const setFocus = (f: AttFocus) => {
    setAttFocus(f);
    saveAttendancePrefs({ focus: f });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [id]: !isExpanded(id, prev) };
      saveAttendancePrefs({ expanded: next });
      return next;
    });
  };

  /** Compact: collapsed unless explicitly opened. Comfortable: open unless explicitly closed. */
  const isExpanded = (id: string, map = expanded) => {
    if (map[id] != null) return map[id]!;
    return density !== "compact";
  };

  const save = async () => {
    setSaveMsg("Saving…");
    const result = await saveNow();
    setSaveMsg(
      result.cloud
        ? `✓ Cloud Saved — ${prettyDate(date)} is now in reports`
        : result.ok
          ? result.message
          : result.message || "Save failed, try again",
    );
    if (result.ok) setTimeout(() => setSaveMsg(""), 6000);
  };

  /** Fill dept start/end for active employees whose punch in & out are empty that day; then sync. */
  const fillStandardTimes = async () => {
    const targets = employees.filter((e) => {
      if (!resolveDeptAsOf(e, depts, date)) return false;
      const r = day[e.id];
      const status = r?.status ?? "present";
      if (status === "leave" || status === "absent") return false;
      return (r?.in == null) && (r?.out == null);
    });
    if (!targets.length) {
      alert(`No active employees with empty punches on ${prettyDate(date)}.`);
      return;
    }
    const okConfirm = confirm(
      `Fill standard shift times for ${targets.length} employee(s) with empty punches on ${prettyDate(date)}?\n\nPunch in/out will be set from each employee's assigned shift for this date, then recalculated and synced.`,
    );
    if (!okConfirm) return;

    for (const e of targets) {
      const dept = resolveDeptAsOf(e, depts, date)!;
      const prev = day[e.id];
      setRec(date, e.id, {
        status: prev?.status === "half" ? "half" : "present",
        in: dept.start,
        out: dept.end,
      });
    }

    setSaveMsg("Saving…");
    const result = await saveNow();
    setSaveMsg(
      result.cloud
        ? `✓ Filled ${targets.length} · ${prettyDate(date)} — Cloud Saved`
        : result.ok
          ? `Filled ${targets.length} on this browser — ${result.message}`
          : `Filled ${targets.length} locally — ${result.message || "sync failed, try Save"}`,
    );
    if (result.ok) setTimeout(() => setSaveMsg(""), 6000);
  };

  const saveBtn = (
    <div className="admin-toolbar gap-3">
      <button type="button" className="btn-primary px-6" onClick={() => void save()}>Save attendance</button>
      {saveMsg && <span className={`text-sm font-semibold ${saveMsg.startsWith("✓") ? "text-primary" : saveMsg.includes("failed") ? "text-destructive" : "text-muted-foreground"}`}>{saveMsg}</span>}
    </div>
  );

  const visible = employees.filter((e) => {
    const rec = day[e.id];
    const r = rec ?? emptyRec();
    const dept = resolveDeptAsOf(e, depts, date);
    const c = calcDay(e, dept, date, r, settings);
    if (attFocus === "all") return true;
    if (attFocus === "missing") return !rec;
    if (attFocus === "leave") return !!rec && r.status === "leave";
    if (attFocus === "inactive") return !!rec && r.status === "absent";
    if (attFocus === "active") return !!rec && (r.status === "present" || r.status === "half");
    if (attFocus === "review") return !!rec && needsReview(e, r, c);
    return true;
  });

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Daily attendance"
        sub={`${prettyDate(date)} · Paste each time from the machine, then click Save.`}
        right={
          <>
            <button
              type="button"
              className={`btn-ghost ${density === "compact" ? "ring-2 ring-primary" : ""}`}
              title="Compact collapses cards; Comfortable keeps details open"
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            >
              {density === "compact" ? "Compact" : "Comfortable"}
            </button>
            <input
              type="date"
              className="field w-auto"
              aria-label="Attendance date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <input
              type="date"
              className="field w-auto"
              title="Payroll range from"
              aria-label="Payroll range from"
              value={rangeFrom}
              onChange={(e) => e.target.value && setRangeFrom(e.target.value)}
            />
            <span className="self-center text-sm text-muted-foreground" aria-hidden>
              to
            </span>
            <input
              type="date"
              className="field w-auto"
              title="Payroll range to"
              aria-label="Payroll range to"
              value={rangeTo}
              onChange={(e) => e.target.value && setRangeTo(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => downloadPayrollCsv(data, rangeFrom, rangeTo, rangeFrom.slice(0, 7))}
            >
              Export Payroll CSV
            </button>
            <button type="button" className="btn-ghost" onClick={() => void fillStandardTimes()}>
              Fill Standard Times
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()}>Save</button>
            <button type="button" className="btn-danger" onClick={() => confirm(`Clear ALL records for ${prettyDate(date)}?`) && resetDay(date)}>
              Reset day
            </button>
          </>
        }
      />

      {monthClosed && (
        <p className="panel text-sm font-semibold text-destructive">
          Month {month} is closed. Reopen from CEO Reports before editing. Closing ≠ Paid (salary status unchanged).
        </p>
      )}

      <div className="tracker-filter-group" role="group" aria-label="Attendance focus filter">
        {FOCUS_CHIPS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFocus(f.id)}
            aria-pressed={attFocus === f.id}
            className={`tracker-filter-btn ${attFocus === f.id ? "tracker-filter-btn-on" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!employees.length && <p className="panel text-muted-foreground">Add your employees in the Team tab first.</p>}
      <div className={density === "compact" ? "space-y-2" : "space-y-3"}>
        {visible.map((e, i) => {
          const dept = resolveDeptAsOf(e, depts, date);
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
          const variance = shiftVariance(dept, r, { grace: settings.grace, date, employee: e });
          const open = isExpanded(e.id);
          return (
            <div key={e.id} className={`admin-emp-card ${density === "compact" ? "admin-emp-card-compact" : ""} ${rec ? "" : "opacity-80"}`}>
              <div className="admin-emp-head">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  onClick={() => toggleExpand(e.id)}
                  aria-expanded={open}
                  title={open ? "Collapse card" : "Expand card"}
                >
                  <span className="mt-0.5 text-muted-foreground" aria-hidden>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="mr-2 font-display text-muted-foreground">{i + 1}.</span>
                    <span className="font-bold tracking-tight">{e.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{dept?.name}</span>
                    {e.afterHours && <span className="chip ml-2 bg-secondary text-secondary-foreground">After-hours</span>}
                    {!rec && <span className="chip ml-2 bg-muted text-muted-foreground">Not entered</span>}
                    {!timesOff && r.in != null && r.out == null && (
                      <span className="chip ml-2 bg-amber-100 text-amber-800" title="Punch in is set but punch out is empty">
                        Missing Clock-Out
                      </span>
                    )}
                    {variance.shiftNotConfigured && (
                      <span className="chip ml-2 bg-muted/70 font-medium text-muted-foreground" title="No department shift times in Team settings">
                        Shift Not Configured
                      </span>
                    )}
                    {!variance.skipped && variance.lateMin > 0 && (
                      <span className="chip ml-2 bg-muted/70 font-medium text-muted-foreground" title={`Arrived ${variance.lateMin} min after shift start`}>
                        Late (+{variance.lateMin} min)
                      </span>
                    )}
                    {!variance.skipped && variance.earlyOutMin > 0 && (
                      <span className="chip ml-2 bg-muted/70 font-medium text-muted-foreground" title={`Left ${variance.earlyOutMin} min before shift end`}>
                        Early Out (−{variance.earlyOutMin} min)
                      </span>
                    )}
                    {!variance.skipped && variance.onTime && (
                      <span className="chip ml-2 bg-muted/70 font-medium text-muted-foreground" title="Within scheduled shift and grace">
                        On Time
                      </span>
                    )}
                    {!open && rec && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {r.status}
                        {c.worked != null ? ` · ${fmtHours(c.worked)} h` : ""}
                        {c.flags.length ? ` · ${c.flags[0]}` : ""}
                      </span>
                    )}
                  </span>
                </button>
                <div className="admin-toolbar" onClick={(ev) => ev.stopPropagation()}>
                  <select className="field w-auto" value={r.status} onChange={(ev) => setStatus(ev.target.value as Status)}>
                    <option value="present">Present</option>
                    <option value="half">Half day</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                  {rec && (
                    <button type="button" className="btn-ghost" onClick={() => confirm(`Reset ${e.name}'s record for this day?`) && resetRec(date, e.id)}>
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {open && (
                <>
                  {r.status === "leave" && (
                    <div className="mb-3 flex items-center gap-3 text-sm">
                      <Toggle checked={r.leavePaid} onChange={(v) => set({ leavePaid: v })} label="Paid leave" />
                      <span className="text-muted-foreground">Balance before this day: {leaveBalance(e, date, records)}</span>
                    </div>
                  )}

                  {!timesOff && (
                    <>
                      <div className="admin-form-grid admin-form-grid-4 grid-cols-2">
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
                    <div className="admin-summary-strip">
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
                </>
              )}
            </div>
          );
        })}
      </div>
      {employees.length > 0 && <div className="admin-emp-card mt-1 flex justify-end">{saveBtn}</div>}
    </div>
  );
}
