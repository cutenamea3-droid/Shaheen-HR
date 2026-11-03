import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Columns3, Info, ChevronUp, Trash2, Pencil, Check, X, Bell, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { analyzeRow, complianceScore, rowIsActive, statusExpiryCol, suggestApplyPlan } from "@/lib/alerts";
import { sectionById } from "@/lib/sections";
import { addRowForDriver, deleteDriver, patchSection, setCell, setRowHeight, useData } from "@/lib/store";
import { ActiveToggle, DateCell, EditableText, StatusToggle } from "./cells";
import { AddDriverDialog } from "./AddDriverDialog";
import { useWorkMode } from "@/lib/workmode";
import { useViewMode } from "@/lib/viewmode";
import { setResizeLock, useResizeLock } from "@/lib/resizelock";
import { Lock, Unlock } from "lucide-react";

type Filter = "all" | "active" | "inactive" | "new";
const NEW_DAYS = 15;
/** The six main sections that must list the same drivers line by line. */
const CORE = ["dmv", "medical", "queries", "ssccdl", "docs", "info"];

/** Active-only by default; Inactive Drivers section defaults to inactive. */
const defaultFilter = (id: string): Filter => (id === "inactive" ? "inactive" : "active");

export function DataTable({ sectionId, focusRow }: { sectionId: string; focusRow?: string | undefined }) {
  const data = useData();
  const def = sectionById(sectionId)!;
  const sec = data.sections[sectionId];
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(() => defaultFilter(sectionId));
  const [alertsOnly, setAlertsOnlyState] = useState(false);
  useEffect(() => {
    setFilter(defaultFilter(sectionId));
    setAlertsOnlyState(localStorage.getItem(`shaheen-issues-only-${sectionId}`) === "1");
  }, [sectionId]);
  // rows shown under "Only Issues" stay on screen after being fixed, until Refresh
  const keepRef = useRef(new Set<string>());
  const [keepTick, setKeepTick] = useState(0);
  useEffect(() => {
    keepRef.current = new Set();
  }, [sectionId]);
  const setAlertsOnly = (v: boolean) => {
    keepRef.current = new Set();
    setAlertsOnlyState(v);
    localStorage.setItem(`shaheen-issues-only-${sectionId}`, v ? "1" : "0");
  };
  const [showRules, setShowRules] = useState(true);
  const work = useWorkMode();
  const view = useViewMode();
  const rlock = useResizeLock();
  const [editHead, setEditHead] = useState<number | null>(null);
  const [headDraft, setHeadDraft] = useState("");
  const [widths, setWidths] = useState(sec.widths);
  const [addOpen, setAddOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setWidths(sec.widths), [sec.widths]);

  const analyzed = useMemo(
    () => sec.rows.map((r) => ({ row: r, ...analyzeRow(def, sec.headers, r), active: rowIsActive(def, r, data) })),
    [sec, def, data],
  );
  // one main name per driver (first main section that has them) so rows sort identically everywhere
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const id of [...CORE, "inactive"]) for (const r of data.sections[id]?.rows ?? []) if (!m.has(r.driverId) && r.cells[0]?.trim()) m.set(r.driverId, r.cells[0].trim());
    return m;
  }, [data]);
  const canon = (r: { driverId: string; cells: string[] }) => nameOf.get(r.driverId) ?? (r.cells[0] ?? "").trim();
  const isNew = (r: { addedAt?: number }) => !!r.addedAt && Date.now() - r.addedAt < NEW_DAYS * 864e5;
  const newCount = analyzed.filter((a) => isNew(a.row)).length;
  const rows = analyzed.filter((a) => {
    // reactivated drivers no longer appear in Inactive Drivers
    if (sectionId === "inactive" && a.active) return false;
    if (filter === "active" && !a.active) return false;
    if (filter === "inactive" && a.active) return false;
    if (filter === "new" && !isNew(a.row)) return false;
    if (alertsOnly) {
      if (a.issues.length) keepRef.current.add(a.row.id);
      else if (!keepRef.current.has(a.row.id)) return false;
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      return a.row.cells.some((c) => c.toLowerCase().includes(s));
    }
    return true;
  }).sort((a, b) =>
    // A–Z by the driver's main name, same in every section (display only; stored order unchanged)
    canon(a.row).localeCompare(canon(b.row), undefined, { sensitivity: "base" }),
  );
  // drivers who are in other main sections but missing here — shown in place so every section lines up
  const missing = useMemo(() => {
    if (!CORE.includes(sectionId)) return [];
    const here = new Set([...sec.rows.map((r) => r.driverId), ...(sec.dismissed ?? [])]);
    const out = new Map<string, string>();
    for (const id of CORE) for (const r of data.sections[id]?.rows ?? []) if (!here.has(r.driverId) && !out.has(r.driverId)) out.set(r.driverId, nameOf.get(r.driverId) ?? r.cells[0]);
    return [...out].map(([driverId, name]) => ({ driverId, name }));
  }, [data, sec, sectionId, nameOf]);
  const showMissing = filter === "all" && !alertsOnly;
  const shownMissing = showMissing ? missing.filter((m) => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase())) : [];
  type Item = { kind: "row"; a: (typeof rows)[number] } | { kind: "missing"; driverId: string; name: string };
  const items: Item[] = [
    ...rows.map((a) => ({ kind: "row" as const, a })),
    ...shownMissing.map((m) => ({ kind: "missing" as const, ...m })),
  ].sort((x, y) => {
    const nx = x.kind === "row" ? canon(x.a.row) : x.name.trim();
    const ny = y.kind === "row" ? canon(y.a.row) : y.name.trim();
    return nx.localeCompare(ny, undefined, { sensitivity: "base" });
  });
  void keepTick;
  const fixedIds = new Set(alertsOnly ? rows.filter((a) => !a.issues.length).map((a) => a.row.id) : []);
  const alertCount = analyzed.filter((a) => a.active && a.issues.length).length;

  useEffect(() => {
    if (!focusRow) return;
    setFilter("all");
    setAlertsOnly(false);
    setQ("");
    const t = setTimeout(() => {
      const el = document.getElementById("row-" + focusRow);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("animate-flash");
        void el.offsetWidth;
        el.classList.add("animate-flash");
      }
    }, 150);
    return () => clearTimeout(t);
  }, [focusRow]);

  const visible = def.types.map((_, i) => !sec.hidden[i]);
  // Status (Active/Inactive) column is always shown last; stored data order is unchanged
  const order = def.types.map((_, i) => i).sort((a, b) => Number(def.types[a] === "active") - Number(def.types[b] === "active"));

  function startColResize(e: React.MouseEvent, i: number) {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = widths[i];
    let latest = widths;
    const move = (ev: MouseEvent) => {
      latest = widths.map((w, j) => (j === i ? Math.max(60, w0 + ev.clientX - x0) : w));
      setWidths(latest);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      patchSection(sectionId, { widths: latest });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
  function startRowResize(e: React.MouseEvent, rowId: string) {
    e.preventDefault();
    const tr = (e.currentTarget as HTMLElement).closest("tr")!;
    const y0 = e.clientY;
    const h0 = tr.getBoundingClientRect().height;
    let h = h0;
    const move = (ev: MouseEvent) => {
      h = Math.max(36, h0 + ev.clientY - y0);
      tr.style.height = h + "px";
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setRowHeight(sectionId, rowId, Math.round(h));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", work ? "gap-2" : "gap-3")}>
      {/* Alert rules */}
      {!work && <div className="rounded-xl border border-primary/30 bg-card shadow-card">
        <button
          type="button"
          onClick={() => setShowRules(!showRules)}
          className="flex w-full items-center justify-between px-4 py-2 text-left"
        >
          <span className="flex items-center gap-2 font-display text-base font-bold">
            <Info className="size-5 text-primary" /> How alerts work in {def.title}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            {showRules ? "Hide" : "Show"} <ChevronUp className={cn("size-4 transition", !showRules && "rotate-180")} />
          </span>
        </button>
        {showRules && (
          <ul className="grid gap-2 px-5 pb-4 md:grid-cols-2">
            {def.rules.map((r) => (
              <li key={r} className="rounded-lg border border-primary/20 bg-accent/40 px-3 py-1.5 text-sm font-medium">
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>}

      {/* Toolbar */}
      <div className="tracker-toolbar">
        <div className="relative min-w-72 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${def.title}…`}
            className="tracker-search"
            aria-label={`Search ${def.title}`}
          />
        </div>
        <div className="tracker-filter-group" role="group" aria-label="Employment filter">
          {(["all", "active", "inactive", "new"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn("tracker-filter-btn capitalize", filter === f && "tracker-filter-btn-on")}
            >
              {f === "all" ? "Show all" : f === "new" ? `New (${newCount})` : f}
            </button>
          ))}
        </div>
        <div className="tracker-filter-group border-danger/30" role="group" aria-label="Issues filter">
          <button
            type="button"
            onClick={() => setAlertsOnly(false)}
            aria-pressed={!alertsOnly}
            className={cn("tracker-filter-btn", !alertsOnly ? "bg-ink text-ink-foreground" : "")}
          >
            Show All
          </button>
          <button
            type="button"
            onClick={() => setAlertsOnly(true)}
            aria-pressed={alertsOnly}
            title="Show only drivers with expired, expiring, missing, applied or note items"
            className={cn(
              "tracker-filter-btn inline-flex items-center gap-1.5",
              alertsOnly ? "bg-danger text-primary-foreground" : "text-danger",
            )}
          >
            <Bell className="size-4" /> Only Issues ({alertCount})
          </button>
        </div>
        {alertsOnly && fixedIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              keepRef.current = new Set();
              setKeepTick((t) => t + 1);
            }}
            title="Remove fixed drivers from this list"
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-ok/40 bg-ok-soft px-3 py-1.5 text-sm font-bold text-ok"
          >
            <Check className="size-4" /> {fixedIds.size} fixed — Refresh list
          </button>
        )}
        <button
          type="button"
          onClick={() => setResizeLock(!rlock)}
          title="Lock column and row sizes so they can't be changed by accident"
          className={cn("inline-flex h-10 items-center gap-2 rounded-xl border-2 px-4 text-sm font-bold shadow-card", rlock ? "border-primary bg-brand text-primary-foreground" : "bg-card hover:border-primary")}
        >
          {rlock ? <Lock className="size-4" /> : <Unlock className="size-4" />} Resize: {rlock ? "Locked" : "Unlocked"}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl border-2 bg-card px-4 text-sm font-bold shadow-card hover:border-primary">
              <Columns3 className="size-4" /> Show / hide columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <p className="mb-2 text-sm font-bold">Columns</p>
            <div className="grid gap-1.5">
              {sec.headers.map((h, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={visible[i]}
                    disabled={i === 0}
                    onChange={() => patchSection(sectionId, { hidden: sec.hidden.map((x, j) => (j === i ? !x : x)) })}
                    className="size-4 accent-primary"
                  />
                  {h.trim() || `Column ${i + 1}`}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => patchSection(sectionId, { hidden: sec.hidden.map(() => false) })}
              className="mt-2 w-full rounded-lg bg-muted py-1.5 text-sm font-semibold"
            >
              Show all columns
            </button>
          </PopoverContent>
        </Popover>
        {def.inWizard && !view && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="ui-press inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-base font-bold text-primary-foreground shadow-pop hover:brightness-105"
          >
            <UserPlus className="size-5" /> Add Driver
          </button>
        )}
      </div>
      {!work && <p className="-mt-1 text-sm text-muted-foreground">
        Showing <b className="text-foreground">{rows.length}</b> of {sec.rows.length} rows · drag column edges or the row grip to resize · click any cell to edit, then press the green ✓
        {missing.length > 0 && <> · <b className="text-warn">{missing.length} driver{missing.length > 1 ? "s" : ""} missing here</b> (highlighted in the list)</>}
      </p>}

      {/* Table */}
      <div className="ui-lift ui-row-hover tracker-table-wrap">
        <table className="table-fixed border-separate border-spacing-0" style={{ width: 70 + widths.reduce((a, w, i) => a + (visible[i] ? w : 0), 0) + 60 }}>
          <colgroup>
            <col style={{ width: 70 }} />
            {order.map((i) => visible[i] && <col key={i} style={{ width: widths[i] }} />)}
            <col style={{ width: 60 }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-brand text-primary-foreground">
              <th className="sticky left-0 z-30 bg-brand px-2.5 py-2 text-left text-base font-extrabold">#</th>
              {order.map((i) => [sec.headers[i], i] as const).map(
                ([h, i]) =>
                  visible[i] && (
                    <th
                      key={i}
                      className={cn(
                        "relative border-l border-ink-foreground/10 px-2.5 py-2 text-left align-middle",
                        i === 0 && "freeze-edge sticky left-[70px] z-30 bg-brand",
                      )}
                    >
                      {editHead === i ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={headDraft}
                            onChange={(e) => setHeadDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                patchSection(sectionId, { headers: sec.headers.map((x, j) => (j === i ? headDraft : x)) });
                                setEditHead(null);
                              }
                              if (e.key === "Escape") setEditHead(null);
                            }}
                            className="min-w-0 flex-1 rounded-md bg-card px-2 py-1 text-base text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              patchSection(sectionId, { headers: sec.headers.map((x, j) => (j === i ? headDraft : x)) });
                              setEditHead(null);
                            }}
                            className="rounded-md bg-ok p-1"
                            aria-label="Save header"
                          >
                            <Check className="size-4" />
                          </button>
                          <button type="button" onClick={() => setEditHead(null)} className="rounded-md bg-ink-foreground/20 p-1" aria-label="Cancel">
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (view) return;
                            setHeadDraft(h);
                            setEditHead(i);
                          }}
                          className="group flex w-full items-center gap-2 text-left text-base font-extrabold leading-tight whitespace-pre-wrap break-words"
                        >
                          {h.trim() || `Column ${i + 1}`}
                          {!view && <Pencil className="size-3.5 shrink-0 text-gold opacity-60 group-hover:opacity-100" />}
                        </button>
                      )}
                      {!rlock && <span
                        onMouseDown={(e) => startColResize(e, i)}
                        className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-gold/60"
                      />}
                    </th>
                  ),
              )}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, ri) => {
              if (it.kind === "missing")
                return (
                  <tr key={"miss-" + it.driverId} className="bg-warn-soft">
                    <td className="sticky left-0 z-10 border-b border-r border-l-4 border-foreground/35 border-l-warn bg-warn-soft px-2 py-1.5 align-top text-sm font-bold text-warn">{ri + 1}</td>
                    <td colSpan={order.filter((i) => visible[i]).length + 1} className="border-b border-foreground/35 bg-warn-soft px-3 py-2">
                      <div className="sticky left-[78px] flex flex-wrap items-center gap-3">
                        <b className="text-base text-foreground">{it.name}</b>
                        <span className="rounded-md bg-warn px-2 py-0.5 text-xs font-bold text-primary-foreground">MISSING IN THIS SECTION</span>
                        <span className="text-sm text-muted-foreground">This driver is in other sections but not here.</span>
                        {!view && (
                          <>
                            <button
                              type="button"
                              onClick={() => addRowForDriver(sectionId, it.driverId, it.name)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1 text-sm font-bold text-primary-foreground hover:brightness-105"
                            >
                              <UserPlus className="size-4" /> Add to this section
                            </button>
                            <button
                              type="button"
                              onClick={() => patchSection(sectionId, { dismissed: [...(sec.dismissed ?? []), it.driverId] })}
                              className="inline-flex items-center gap-1 rounded-lg border bg-card px-3 py-1 text-sm font-bold text-foreground hover:bg-muted"
                            >
                              <X className="size-4" /> Not needed here
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete ${it.name.trim()} from ALL sections? This cannot be undone.`)) deleteDriver(it.driverId);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-bold text-danger hover:bg-danger-soft"
                            >
                              <Trash2 className="size-4" /> Delete driver
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              const { row, cellTone, issues, active } = it.a;
              return (
              <tr
                key={row.id}
                id={"row-" + row.id}
                style={row.height ? { height: row.height } : undefined}
                className={cn("group/row bg-card", !active && "opacity-60", sel === row.id && "row-selected")}
              >
                <td
                  onClick={() => setSel(sel === row.id ? null : row.id)}
                  title={isNew(row) ? "New driver (added in last 15 days)" : "Click to select this driver's row"}
                  className={cn(
                    "sticky left-0 z-10 cursor-pointer select-none border-b border-r border-foreground/35 px-2 py-1.5 align-top text-sm font-bold text-foreground", issues.length > 0 ? "bg-danger-row" : "bg-card",
                    issues.length > 0 && "border-l-4 border-l-danger text-danger",
                  )}
                >
                  <div className="relative h-full">
                    {ri + 1}
                    {isNew(row) && <span className="mt-1 block rounded bg-ok-soft px-1 text-[10px] font-bold text-ok">NEW</span>}
                    {issues.length > 0 && (
                      <span
                        className="tracker-status-dot mt-1 block bg-danger"
                        title={issues.map((x) => x.label).join("\n")}
                        aria-label={`${issues.length} issue${issues.length > 1 ? "s" : ""}`}
                      />
                    )}
                  </div>
                  {!rlock && <span
                    onMouseDown={(e) => startRowResize(e, row.id)}
                    title="Drag to resize row"
                    className="absolute right-0 bottom-0 left-0 h-2 cursor-row-resize hover:bg-primary/40"
                  />}
                </td>
                {order.map((ci) => [def.types[ci], ci] as const).map(([t, ci]) => {
                  if (!visible[ci]) return null;
                  const v = row.cells[ci] ?? "";
                  const save = (nv: string) => setCell(sectionId, row.id, ci, nv);
                  const tone = cellTone[ci];
                  const flagged = !!tone && tone !== "ok" && tone !== "muted";
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "border-b border-r border-foreground/35 px-2 py-1.5 align-top text-foreground", issues.length > 0 ? "bg-danger-row" : "bg-card",
                        flagged && "ring-2 ring-inset ring-danger",
                        ci === 0 && "freeze-edge sticky left-[70px] z-10",
                      )}
                    >
                      {t === "name" && (
                        <span data-driver-name className="flex items-start gap-1.5">
                          <EditableText value={v} onSave={save} bold className="text-base" />
                          {fixedIds.has(row.id) && (
                            <span className="mt-1 shrink-0 rounded-md bg-ok-soft px-1.5 py-0.5 text-xs font-bold text-ok">Fixed ✓</span>
                          )}
                        </span>
                      )}
                      {(t === "text" || t === "state") && (
                        <EditableText value={v} onSave={save} boxed={!!tone} tone={tone} className={t === "state" ? "font-bold" : ""} />
                      )}
                      {t === "secret" && <EditableText value={v} onSave={save} mask tone={tone} boxed={!!tone} />}
                      {(t === "note" || t === "plan" || t === "tempnote") && (
                        <div>
                          <EditableText
                            value={v}
                            onSave={save}
                            boxed
                            tone={tone ?? (v.trim() && t === "plan" ? undefined : tone)}
                            placeholder={
                              t === "plan"
                                ? "Add future plan"
                                : t === "tempnote"
                                  ? "Add temporary reminder (never highlights)"
                                  : "Add note"
                            }
                          />
                          {t === "plan" && sectionId === "queries" && (() => {
                            const expiryIdx = ci === 6 ? 2 : ci === 7 ? 4 : -1;
                            const suggestion = expiryIdx >= 0 ? suggestApplyPlan(row.cells[expiryIdx] ?? "") : null;
                            if (!suggestion) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => save(suggestion)}
                                title="Click to fill this suggested apply date (you can still type freely)"
                                className="mt-1 inline-flex max-w-full items-center rounded-lg border border-primary/40 bg-primary/10 px-2 py-0.5 text-left text-xs font-semibold text-primary transition hover:bg-primary/20"
                              >
                                <span className="truncate">Suggest: {suggestion}</span>
                              </button>
                            );
                          })()}
                        </div>
                      )}
                      {t === "date" && (
                        <DateCell
                          value={v}
                          onSave={save}
                          tone={tone}
                          appliedStatus={
                            // Pair Exact Expiration with its status column (DMV / Queries Applied).
                            def.types.findIndex((x, idx) => x === "status" && statusExpiryCol(sectionId, idx) === ci) >= 0
                              ? row.cells[
                                  def.types.findIndex((x, idx) => x === "status" && statusExpiryCol(sectionId, idx) === ci)
                                ]
                              : undefined
                          }
                        />
                      )}
                      {t === "status" && (
                        <StatusToggle
                          value={v}
                          options={def.statusOptions}
                          onSave={save}
                          expiryValue={(() => {
                            const exp = statusExpiryCol(sectionId, ci);
                            return exp != null ? row.cells[exp] : undefined;
                          })()}
                        />
                      )}
                      {t === "active" && <ActiveToggle value={v} onSave={save} />}
                      {t === "score" && <ScoreBar value={complianceScore(row)} />}
                    </td>
                  );
                })}
                <td className={cn("border-b border-foreground/35 px-2 py-3 align-top", issues.length > 0 ? "bg-danger-row" : "bg-card")}>
                  {!view && <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete ${row.cells[0].trim()} from ALL sections? This cannot be undone.`)) deleteDriver(row.driverId);
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                    aria-label="Delete driver"
                  >
                    <Trash2 className="size-5" />
                  </button>}
                </td>
              </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={def.types.length + 2} className="p-10 text-center text-lg text-muted-foreground">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AddDriverDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const tone = value === 100 ? "bg-ok" : value >= 75 ? "bg-warn" : "bg-danger";
  const txt = value === 100 ? "text-ok" : value >= 75 ? "text-warn" : "text-danger";
  return (
    <div>
      <div className={cn("font-display text-xl font-extrabold", txt)}>{value}%</div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
