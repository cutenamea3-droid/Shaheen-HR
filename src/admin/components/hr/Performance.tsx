import { useMemo, useState } from "react";
import { useApp } from "@/admin/lib/store";
import { calcDay, prettyDate } from "@/admin/lib/calc";
import { autoNote, ratingTone } from "@/admin/lib/reports";
import { RATING_LABEL, type Rating } from "@/admin/lib/types";
import {
  PERF_LAYER_LABEL,
  assertLayersDistinct,
  collectPerfAssessment,
  collectPerfFacts,
  collectPerfStatements,
  usePerfFollowUps,
} from "@/admin/lib/perf-followups";
import { useHrAuditHistory } from "@/admin/lib/hr-audit-history";
import { isDateInClosedMonth, useMonthClosing } from "@/admin/lib/month-closing";
import { SectionTitle, Tone } from "./common";
import { useWorkDate } from "@/admin/lib/workdate";

/**
 * Performance & Follow-Ups — facts ≠ statements ≠ assessment.
 * Facts come only from attendance calc; assessment is HR rating; statements are recorded text.
 */
export function Performance() {
  const { date, setDate } = useWorkDate();
  const { employees, depts, records, perf, settings, setPerf } = useApp();
  const isClosedFn = useMonthClosing((s) => s.isClosed);
  const closed = isDateInClosedMonth(date, isClosedFn);
  const hrStatements = usePerfFollowUps((s) => s.hrStatements);
  const followUps = usePerfFollowUps((s) => s.followUps);
  const addFollowUp = usePerfFollowUps((s) => s.addFollowUp);
  const completeFollowUp = usePerfFollowUps((s) => s.completeFollowUp);
  const addHrStatement = usePerfFollowUps((s) => s.addHrStatement);
  const recordAudit = useHrAuditHistory((s) => s.record);

  const [fuEmp, setFuEmp] = useState("");
  const [fuTitle, setFuTitle] = useState("");
  const [fuDue, setFuDue] = useState(date);
  const [stmtText, setStmtText] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const list = employees.filter((e) => records[date]?.[e.id]);
  const openFu = useMemo(() => followUps.filter((f) => f.status === "open"), [followUps]);

  const onAddFollowUp = () => {
    const emp = employees.find((e) => e.id === fuEmp);
    const r = addFollowUp({
      employeeId: fuEmp,
      employeeName: emp?.name ?? "",
      due: fuDue,
      title: fuTitle,
      linkedDate: date,
    });
    if ("error" in r) {
      setMsg(r.error);
      return;
    }
    recordAudit({
      who: "HR",
      kind: "perf_followup_add",
      detail: `Follow-up “${r.title}” for ${r.employeeName}`,
      employeeId: r.employeeId,
      month: date.slice(0, 7),
    });
    setFuTitle("");
    setMsg("Follow-up added.");
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Performance & Follow-Ups"
        sub={`${prettyDate(date)} · Facts (attendance) ≠ Statements (text) ≠ Assessment (rating). Violations appear as facts only.`}
        right={<input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
      />

      {closed && (
        <p className="panel text-sm font-semibold text-destructive">
          This date falls in a closed month. Reopen the month from CEO Reports to edit. Closing ≠ Paid.
        </p>
      )}

      <section className="admin-emp-card space-y-3" aria-label="Follow-ups">
        <h3 className="font-bold tracking-tight">Performance follow-ups</h3>
        <p className="text-sm text-muted-foreground">Desk list only — not push or email. Separate from assessment ratings.</p>
        <div className="admin-toolbar flex-wrap">
          <select className="field w-auto" value={fuEmp} onChange={(e) => setFuEmp(e.target.value)} aria-label="Follow-up employee">
            <option value="">Employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input className="field min-w-[180px] flex-1" placeholder="Follow-up title" value={fuTitle} onChange={(e) => setFuTitle(e.target.value)} />
          <input type="date" className="field w-auto" value={fuDue} onChange={(e) => e.target.value && setFuDue(e.target.value)} />
          <button type="button" className="btn-primary" onClick={onAddFollowUp}>
            Add follow-up
          </button>
        </div>
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <ul className="space-y-2 text-sm">
          {openFu.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <span>
                <strong>{f.employeeName}</strong> — {f.title} · due {f.due}
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  completeFollowUp(f.id);
                  recordAudit({
                    who: "HR",
                    kind: "perf_followup_done",
                    detail: `Completed follow-up “${f.title}”`,
                    employeeId: f.employeeId,
                    month: f.due.slice(0, 7),
                  });
                }}
              >
                Mark done
              </button>
            </li>
          ))}
          {!openFu.length && <li className="text-muted-foreground">No open performance follow-ups.</li>}
        </ul>
      </section>

      {!list.length && <p className="panel text-muted-foreground">No attendance entered for this day yet.</p>}
      <div className="space-y-3">
        {list.map((e) => {
          const rec = records[date]![e.id]!;
          const c = calcDay(e, depts.find((d) => d.id === e.deptId), date, rec, settings);
          const p = perf[date]?.[e.id] ?? { rating: "", note: "" };
          const tone = ratingTone(p.rating);
          const auto = autoNote(c);
          const facts = collectPerfFacts({ employee: e, depts, date, rec, settings });
          const statements = collectPerfStatements({
            employeeId: e.id,
            date,
            rec,
            perf: p,
            hrStatements,
          });
          const assessment = collectPerfAssessment({ employeeId: e.id, date, perf: p });
          void assertLayersDistinct(facts, assessment);

          return (
            <div key={e.id} className="admin-emp-card space-y-3">
              <div className="admin-emp-head">
                <span className="font-bold tracking-tight">
                  <span className="mr-2 text-muted-foreground">{employees.indexOf(e) + 1}.</span>
                  {e.name}
                </span>
                <select
                  className="field w-auto"
                  value={p.rating}
                  disabled={closed}
                  onChange={(ev) => setPerf(date, e.id, { rating: ev.target.value as Rating })}
                  aria-label={`${e.name} assessment rating`}
                >
                  <option value="">Select assessment</option>
                  {(Object.keys(RATING_LABEL) as Rating[]).map((r) => (
                    <option key={r} value={r}>
                      {RATING_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{PERF_LAYER_LABEL.fact}</p>
                  {facts.length ? (
                    <ul className="space-y-1 text-sm">
                      {facts.map((f, i) => (
                        <li key={`${f.kind}-${i}`}>
                          <Tone tone="red">
                            {f.kind}: {f.detail}
                          </Tone>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Tone tone="green">No attendance facts</Tone>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{PERF_LAYER_LABEL.statement}</p>
                  {statements.length ? (
                    <ul className="space-y-1 text-sm">
                      {statements.map((st, i) => (
                        <li key={`${st.source}-${i}`}>
                          <span className="text-muted-foreground">[{st.source}] </span>
                          {st.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No statements</p>
                  )}
                  <textarea
                    className="field mt-2 h-14 py-2"
                    placeholder="Add HR statement (not a rating)"
                    disabled={closed}
                    value={stmtText[e.id] ?? ""}
                    onChange={(ev) => setStmtText((m) => ({ ...m, [e.id]: ev.target.value }))}
                  />
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-primary underline"
                    disabled={closed}
                    onClick={() => {
                      const r = addHrStatement(e.id, date, stmtText[e.id] ?? "");
                      if ("error" in r) setMsg(r.error);
                      else {
                        setStmtText((m) => ({ ...m, [e.id]: "" }));
                        setMsg("HR statement recorded.");
                      }
                    }}
                  >
                    Save statement
                  </button>
                </div>
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{PERF_LAYER_LABEL.assessment}</p>
                  <p className="text-sm">
                    {assessment.rating ? <Tone tone={tone}>{assessment.ratingLabel}</Tone> : <span className="text-muted-foreground">Not assessed</span>}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Assessment is never auto-filled from facts.</p>
                </div>
              </div>

              <textarea
                className="field h-16 py-2"
                placeholder="Performance note (statement layer)"
                disabled={closed}
                value={p.note}
                onChange={(ev) => setPerf(date, e.id, { note: ev.target.value })}
              />
              {auto && !p.note && !closed && (
                <button className="mt-1 text-xs font-semibold text-primary underline" onClick={() => setPerf(date, e.id, { note: auto })}>
                  Use auto note as statement
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
