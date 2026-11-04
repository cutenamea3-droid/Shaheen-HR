import { useApp } from "@/admin/lib/store";
import { calcDay, prettyDate } from "@/admin/lib/calc";
import { autoNote, ratingTone } from "@/admin/lib/reports";
import { RATING_LABEL, type Rating } from "@/admin/lib/types";
import { SectionTitle, Tone } from "./common";
import { useWorkDate } from "@/admin/lib/workdate";

export function Performance() {
  const { date, setDate } = useWorkDate();
  const { employees, depts, records, perf, settings, setPerf } = useApp();
  const list = employees.filter((e) => records[date]?.[e.id]);
  return (
    <div className="space-y-4">
      <SectionTitle
        title="Daily performance"
        sub={`${prettyDate(date)} · Violations from attendance appear automatically.`}
        right={<input type="date" className="field w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
      />
      {!list.length && <p className="panel text-muted-foreground">No attendance entered for this day yet.</p>}
      <div className="space-y-3">
        {list.map((e) => {
          const c = calcDay(e, depts.find((d) => d.id === e.deptId), date, records[date]![e.id]!, settings);
          const p = perf[date]?.[e.id] ?? { rating: "", note: "" };
          const tone = ratingTone(p.rating);
          const auto = autoNote(c);
          return (
            <div key={e.id} className="admin-emp-card">
              <div className="admin-emp-head">
                <span className="font-bold tracking-tight">
                  <span className="mr-2 text-muted-foreground">{employees.indexOf(e) + 1}.</span>
                  {e.name}
                </span>
                <select className="field w-auto" value={p.rating} onChange={(ev) => setPerf(date, e.id, { rating: ev.target.value as Rating })}>
                  <option value="">Select rating</option>
                  {(Object.keys(RATING_LABEL) as Rating[]).map((r) => (
                    <option key={r} value={r}>
                      {RATING_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mb-2 text-sm">
                Auto note: {auto ? <Tone tone="red">{auto}</Tone> : <Tone tone="green">No violations</Tone>}
              </p>
              <textarea
                className="field h-16 py-2"
                placeholder="Performance note"
                value={p.note}
                onChange={(ev) => setPerf(date, e.id, { note: ev.target.value })}
              />
              {auto && !p.note && (
                <button className="mt-2 text-xs font-semibold text-primary underline" onClick={() => setPerf(date, e.id, { note: auto })}>
                  Use auto note
                </button>
              )}
              {p.rating && (
                <p className="mt-2 text-sm">
                  <Tone tone={tone}>{RATING_LABEL[p.rating]}</Tone>
                  {p.note && <> — <Tone tone={tone}>{p.note}</Tone></>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
