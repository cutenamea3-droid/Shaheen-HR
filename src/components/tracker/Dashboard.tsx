import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileDown, CalendarClock, AlertTriangle, Users, ShieldCheck, Clock3, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS, type SectionDef } from "@/lib/sections";
import { analyzeRow, collectPlans, complianceScore, daysUntil, fmtDate, matchesExpFilter, rowIsActive, today, type ExpFilter, type Issue, type Tone } from "@/lib/alerts";
import { downloadReportPdf } from "@/lib/pdf";
import { useData } from "@/lib/store";
import { Chip } from "./cells";
import { ExpirationFilter } from "./ExpirationFilter";
import { SECTION_ICONS } from "./AppShell";

type Cat = "all" | "expired" | "soon" | "applied" | "missing" | "notes";
const CATS: { id: Cat; label: string; match: (i: Issue) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "expired", label: "Expired", match: (i) => i.tone === "danger" && /expired/i.test(i.label) },
  { id: "soon", label: "Expiring soon", match: (i) => i.tone === "warn" },
  { id: "applied", label: "Applied", match: (i) => i.tone === "info" },
  { id: "missing", label: "Missing / Invalid", match: (i) => (i.tone === "danger" && !/expired/i.test(i.label)) || i.tone === "sign" },
  { id: "notes", label: "Notes", match: (i) => i.tone === "note" },
];
type ActiveF = "active" | "inactive" | "all";

export function Dashboard() {
  const data = useData();
  const [af, setAf] = useState<ActiveF>("active");
  const [exp, setExp] = useState<ExpFilter>("all");
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const dmv = data.sections.dmv.rows;
    const def = SECTIONS[0];
    const active = dmv.filter((r) => rowIsActive(def, r, data)).length;
    const docs = data.sections.docs.rows.filter((r) => rowIsActive(SECTIONS[4], r, data));
    const avg = docs.length ? Math.round(docs.reduce((a, r) => a + complianceScore(r), 0) / docs.length) : 0;
    let alerts = 0;
    let expired = 0;
    for (const d of SECTIONS) {
      const sec = data.sections[d.id];
      for (const r of sec.rows) {
        if (!rowIsActive(d, r, data)) continue;
        const { issues } = analyzeRow(d, sec.headers, r);
        if (issues.length) alerts++;
        if (issues.some((i) => /expired/i.test(i.label))) expired++;
      }
    }
    return { total: dmv.length, active, inactive: dmv.length - active, avg, alerts, expired };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Users} label="Total drivers" value={stats.total} sub={`${stats.active} active · ${stats.inactive} inactive`} tone="bg-brand" />
        <Stat icon={AlertTriangle} label="Rows needing attention" value={stats.alerts} sub="across all sections" tone="bg-danger" />
        <Stat icon={Clock3} label="Already expired" value={stats.expired} sub="act today" tone="bg-warn" />
        <Stat icon={ShieldCheck} label="Avg document compliance" value={`${stats.avg}%`} sub="Other Documents" tone="bg-eagle" />
        <Stat icon={CalendarClock} label="Today" value={today().toLocaleDateString("en-US", { day: "numeric", month: "short" })} sub={today().toLocaleDateString("en-US", { weekday: "long", year: "numeric" })} tone="bg-info" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-72 flex-1">
          <Search className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a driver across every alert…"
            className="h-12 w-full rounded-xl border-2 bg-card pr-4 pl-11 text-base shadow-card outline-none focus:border-primary"
          />
        </div>
        <div className="inline-flex rounded-xl border-2 bg-card p-1 shadow-card">
          {(["active", "inactive", "all"] as ActiveF[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setAf(f)}
              className={cn("rounded-lg px-4 py-2 text-sm font-bold capitalize", af === f ? "bg-brand text-primary-foreground" : "text-muted-foreground")}
            >
              {f === "all" ? "Show all" : f}
            </button>
          ))}
        </div>
      </div>

      <ExpirationFilter value={exp} onChange={setExp} />

      <TodayPanel />

      <FuturePlans />

      <div className="grid gap-5 2xl:grid-cols-2">
        {SECTIONS.filter((s) => s.id !== "inactive").map((def) => (
          <SectionAlerts key={def.id} def={def} af={af} q={q} exp={exp} />
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: React.ReactNode; sub: string; tone: string }) {
  return (
    <div className="ui-lift flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-card">
      <div className={cn("grid size-14 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-card", tone)}>
        <Icon className="size-7" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-muted-foreground">{label}</div>
        <div className="font-display text-3xl font-extrabold">{value}</div>
        <div className="text-sm text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function SectionAlerts({ def, af, q, exp }: { def: SectionDef; af: ActiveF; q: string; exp: ExpFilter }) {
  const data = useData();
  const navigate = useNavigate();
  const [cat, setCat] = useState<Cat>("all");
  const [report, setReport] = useState<"missing" | "applied" | "all">("missing");
  const sec = data.sections[def.id];
  const Icon = SECTION_ICONS[def.id];

  const items = useMemo(
    () =>
      sec.rows
        .filter((r) => {
          const a = rowIsActive(def, r, data);
          return af === "all" || (af === "active" ? a : !a);
        })
        .filter((r) => matchesExpFilter(data, r.driverId, exp))
        .map((r) => ({ row: r, issues: analyzeRow(def, sec.headers, r).issues }))
        .filter((x) => x.issues.length)
        .filter((x) => !q.trim() || x.row.cells[0].toLowerCase().includes(q.toLowerCase())),
    [sec, def, data, af, q, exp],
  );
  const catCount = (c: Cat) => items.filter((x) => x.issues.some(CATS.find((k) => k.id === c)!.match)).length;
  const shown = items.filter((x) => x.issues.some(CATS.find((k) => k.id === cat)!.match));

  function pdf() {
    const m = report === "all" ? CATS[0].match : report === "applied" ? CATS[3].match : CATS[4].match;
    const rows = items
      .map((x) => ({ x, iss: x.issues.filter(m) }))
      .filter((y) => y.iss.length)
      .map(({ x, iss }) => [x.row.cells[0].trim(), iss.map((i) => i.label).join("\n"), noteText(def, x.row.cells)]);
    const label = report === "all" ? "All alerts" : report === "applied" ? "Applied" : "Missing & Invalid";
    downloadReportPdf(def.title, label, ["Driver", "Issues", "Notes / Plans"], rows);
  }

  return (
    <section className="ui-lift flex flex-col rounded-2xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand text-primary-foreground">
            <Icon className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{def.title}</h2>
            <p className="text-sm text-muted-foreground">{items.length} drivers need attention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={report}
            onChange={(e) => setReport(e.target.value as typeof report)}
            className="h-10 rounded-lg border-2 bg-card px-2 text-sm font-semibold"
          >
            <option value="missing">Missing / Invalid</option>
            {def.statusOptions.includes("Applied") && <option value="applied">Applied</option>}
            <option value="all">All alerts</option>
          </select>
          <button type="button" onClick={pdf} className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-bold text-ink-foreground hover:opacity-90">
            <FileDown className="size-4" /> PDF
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {CATS.map((c) => {
          const n = c.id === "all" ? items.length : catCount(c.id);
          if (c.id !== "all" && !n) return null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={cn(
                "rounded-lg border-2 px-3 py-1.5 text-sm font-bold",
                cat === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-muted/60 hover:border-primary/50",
              )}
            >
              {c.label} <span className="opacity-75">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="max-h-[440px] space-y-2 overflow-y-auto p-5">
        {!shown.length && <p className="rounded-xl bg-ok-soft px-4 py-6 text-center text-base font-semibold text-ok">All clear here ✓</p>}
        {shown.map(({ row, issues }) => (
          <button
            key={row.id}
            type="button"
            onClick={() => navigate({ to: "/s/$sectionId", params: { sectionId: def.id }, search: { row: row.id } })}
            className="ui-press group flex w-full items-start gap-3 rounded-xl border-2 border-transparent bg-muted/50 px-4 py-3 text-left transition hover:border-primary/50 hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[1.05rem] font-extrabold">{row.cells[0].trim()}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {dedupe(issues).map((i, k) => (
                  <Chip key={k} tone={i.tone}>{i.label}</Chip>
                ))}
              </div>
              {noteText(def, row.cells) && (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-note-soft px-3 py-2 text-sm">{noteText(def, row.cells)}</p>
              )}
            </div>
            <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
          </button>
        ))}
      </div>
    </section>
  );
}

function dedupe(issues: Issue[]) {
  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(i.label) ? false : (seen.add(i.label), true)));
}
function noteText(def: SectionDef, cells: string[]) {
  return def.types
    .map((t, i) => (t === "note" ? cells[i]?.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

type Range = "overdue" | "today" | "week" | "month" | "next" | "year" | "all";
const RANGES: { id: Range; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "month", label: "This month" },
  { id: "next", label: "Next month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All upcoming" },
];

function FuturePlans() {
  const data = useData();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("month");
  const [secF, setSecF] = useState("all");
  const plans = useMemo(() => collectPlans(data), [data]);
  const t = today();
  const inRange = (d: Date) => {
    const n = daysUntil(d);
    switch (range) {
      case "overdue": return n < 0;
      case "today": return n === 0;
      case "week": return n >= 0 && n <= 7;
      case "month": return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
      case "next": {
        const nm = new Date(t.getFullYear(), t.getMonth() + 1, 1);
        return d.getMonth() === nm.getMonth() && d.getFullYear() === nm.getFullYear();
      }
      case "year": return d.getFullYear() === t.getFullYear();
      default: return n >= 0;
    }
  };
  const list = plans.filter((p) => inRange(p.date) && (secF === "all" || p.sectionId === secF));
  const toneFor = (d: Date): Tone => {
    const n = daysUntil(d);
    return n < 0 ? "danger" : n === 0 ? "warn" : n <= 7 ? "info" : "ok";
  };
  return (
    <section className="ui-lift rounded-2xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-sky px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-eagle text-primary-foreground">
            <CalendarClock className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">Future Plans & Tasks</h2>
            <p className="text-sm text-muted-foreground">Dates read from your Future Plans / Notes text in every section</p>
          </div>
        </div>
        <select value={secF} onChange={(e) => setSecF(e.target.value)} className="h-10 rounded-lg border-2 bg-card px-2 text-sm font-semibold">
          <option value="all">All sections</option>
          {SECTIONS.filter((s) => ["dmv", "medical", "queries", "ssccdl"].includes(s.id)).map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={cn("rounded-lg border-2 px-3 py-1.5 text-sm font-bold", range === r.id ? "border-eagle bg-eagle text-primary-foreground" : "bg-muted/60 hover:border-eagle/50")}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-[420px] gap-2 overflow-y-auto p-5 md:grid-cols-2 xl:grid-cols-3">
        {!list.length && <p className="col-span-full rounded-xl bg-muted px-4 py-6 text-center text-base text-muted-foreground">No plans in this range.</p>}
        {list.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigate({ to: "/s/$sectionId", params: { sectionId: p.sectionId }, search: { row: p.rowId } })}
            className="flex items-start gap-3 rounded-xl border-2 border-transparent bg-muted/50 p-3 text-left hover:border-eagle/50"
          >
            <Chip tone={toneFor(p.date)} className="shrink-0 flex-col gap-0 px-3 py-1.5 text-center leading-tight">
              <span className="text-xs uppercase">{p.date.toLocaleDateString("en-US", { month: "short" })}</span>
              <span className="font-display text-xl">{p.date.getDate()}</span>
            </Chip>
            <div className="min-w-0">
              <div className="font-extrabold">{p.driver.trim()}</div>
              <div className="text-xs font-bold tracking-wide text-primary uppercase">{SECTIONS.find((s) => s.id === p.sectionId)?.title}</div>
              <p className="mt-1 text-sm whitespace-pre-wrap break-words">{p.text}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(p.date)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

type UrgentItem = { key: string; sec: SectionDef; rowId: string; name: string; label: string; left: number };

function urgentLeft(i: Issue): number | null {
  const ex = /expired (\d+)d ago/i.exec(i.label);
  if (ex) return -Number(ex[1]);
  const so = /expires in (\d+)d/i.exec(i.label);
  if (so && Number(so[1]) <= 7) return Number(so[1]);
  return null;
}

function TodayPanel() {
  const data = useData();
  const navigate = useNavigate();
  const dayKey = `shaheen-checklist-${today().toISOString().slice(0, 10)}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(dayKey) || "{}")); } catch { /* ignore */ }
  }, [dayKey]);
  const toggle = (k: string) => {
    const n = { ...done, [k]: !done[k] };
    setDone(n);
    localStorage.setItem(dayKey, JSON.stringify(n));
  };

  const { urgent, ready, activeCount, tasks } = useMemo(() => {
    const urgent: UrgentItem[] = [];
    const bad = new Set<string>();
    const names = new Set<string>();
    const t = { expired: 0, soon: 0, applied: 0, missing: 0 };
    for (const def of SECTIONS) {
      if (def.id === "inactive") continue;
      const sec = data.sections[def.id];
      for (const r of sec.rows) {
        if (!rowIsActive(def, r, data)) continue;
        const name = r.cells[0].trim();
        names.add(name.toLowerCase());
        for (const i of analyzeRow(def, sec.headers, r).issues) {
          if (i.tone !== "note") bad.add(name.toLowerCase());
          const left = urgentLeft(i);
          if (left !== null) urgent.push({ key: `${def.id}-${r.id}-${i.col}`, sec: def, rowId: r.id, name, label: i.label, left });
          if (CATS[1].match(i)) t.expired++;
          else if (CATS[2].match(i)) t.soon++;
          else if (CATS[3].match(i)) t.applied++;
          else if (CATS[4].match(i)) t.missing++;
        }
      }
    }
    urgent.sort((a, b) => a.left - b.left);
    const activeCount = names.size;
    const ready = activeCount ? Math.round(((activeCount - [...bad].filter((n) => names.has(n)).length) / activeCount) * 100) : 100;
    const tasks = [
      { k: "expired", n: t.expired, label: "expired items to renew today" },
      { k: "soon", n: t.soon, label: "drivers to call about expiring items" },
      { k: "applied", n: t.applied, label: "applied items to follow up" },
      { k: "missing", n: t.missing, label: "missing / invalid documents to collect" },
    ].filter((x) => x.n);
    return { urgent, ready, activeCount, tasks };
  }, [data]);

  const tone = ready >= 90 ? "bg-ok" : ready >= 70 ? "bg-warn" : "bg-danger";

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <section className="ui-lift rounded-2xl border bg-card shadow-card xl:col-span-2">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="grid size-11 place-items-center rounded-xl bg-danger text-primary-foreground"><AlertTriangle className="size-6" /></div>
          <div>
            <h2 className="text-xl font-extrabold">Urgent — act first</h2>
            <p className="text-sm text-muted-foreground">Expired or expiring within 7 days · {urgent.length} items</p>
          </div>
        </div>
        <div className="max-h-[320px] space-y-2 overflow-y-auto p-5">
          {!urgent.length && <p className="rounded-xl bg-ok-soft px-4 py-6 text-center text-base font-semibold text-ok">Nothing urgent this week ✓</p>}
          {urgent.map((u) => (
            <button
              key={u.key}
              type="button"
              onClick={() => navigate({ to: "/s/$sectionId", params: { sectionId: u.sec.id }, search: { row: u.rowId } })}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-transparent bg-muted/50 px-4 py-2.5 text-left hover:border-primary/50 hover:bg-accent"
            >
              <span className={cn("w-20 shrink-0 rounded-lg px-2 py-1 text-center text-sm font-extrabold text-primary-foreground", u.left < 0 ? "bg-danger" : "bg-warn")}>
                {u.left < 0 ? "Expired" : u.left === 0 ? "Today" : `${u.left}d left`}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{u.name}</span>
                <span className="block text-sm text-muted-foreground">{u.sec.title} · {u.label}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-5">
        <section className="ui-lift rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><ShieldCheck className="size-5" /> DOT Audit Readiness</div>
          <div className="mt-1 font-display text-4xl font-extrabold">{ready}%</div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", tone)} style={{ width: `${ready}%` }} /></div>
          <p className="mt-2 text-sm text-muted-foreground">Active drivers with a fully clean file (notes not counted) out of {activeCount}.</p>
        </section>
        <section className="ui-lift rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2 text-base font-extrabold"><CalendarClock className="size-5" /> Today's Checklist</div>
          {!tasks.length && <p className="text-sm font-semibold text-ok">No tasks today ✓</p>}
          <div className="space-y-2">
            {tasks.map((t) => (
              <label key={t.k} className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <input type="checkbox" checked={!!done[t.k]} onChange={() => toggle(t.k)} className="size-5 accent-[var(--primary)]" />
                <span className={cn("text-sm", done[t.k] && "text-muted-foreground line-through")}><b>{t.n}</b> {t.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
