import { useEffect, useMemo, useState } from "react";
import { Search, FolderOpen, Trash2, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SECTIONS, formatDriverStatus, type DriverStatus, type Row } from "@/lib/sections";
import {
  alertsMuteBanner,
  analyzeRow,
  complianceScore,
  matchesExpFilter,
  normStatus,
  rowAlertsMuted,
  rowDriverStatus,
  rowIsActive,
  suggestApplyPlan,
  type ExpFilter,
} from "@/lib/alerts";
import { deleteDriver, setCell, useData } from "@/lib/store";
import { useViewMode } from "@/lib/viewmode";
import { ActiveToggle, DateCell, EditableText, StatusToggle } from "./cells";
import { ExpirationFilter } from "./ExpirationFilter";

// The cards read and write the exact same rows as the sections — no copies.
const CARD_SECTIONS = SECTIONS.filter((s) => s.id !== "inactive");

interface Driver {
  driverId: string;
  name: string;
  active: boolean;
  status: DriverStatus;
  issues: number;
  phone: string;
  cdl: string;
  state: string;
  valid: number;
  total: number;
  /** Section/row/col to write employment status from the cards list. */
  statusTarget?: { sectionId: string; rowId: string; col: number };
}

type StatusFilter = "active" | "leave" | "inactive" | "all";

const STATUS_BADGE: Record<DriverStatus, string> = {
  active: "bg-ok-soft text-ok",
  leave: "bg-warn-soft text-warn",
  inactive: "bg-muted text-muted-foreground",
};

export function DriverCards({ focusDriver }: { focusDriver?: string | undefined } = {}) {
  const data = useData();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [exp, setExp] = useState<ExpFilter>("all");
  const view = useViewMode();
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusDriver) return;
    setStatusFilter("all");
    setExp("all");
    setQ("");
    const t = setTimeout(() => {
      const el = document.getElementById("driver-" + focusDriver);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("animate-flash");
        void (el as HTMLElement).offsetWidth;
        el.classList.add("animate-flash");
      }
    }, 150);
    return () => clearTimeout(t);
  }, [focusDriver]);

  const drivers = useMemo(() => {
    const map = new Map<string, Driver>();
    for (const def of CARD_SECTIONS) {
      const sec = data.sections[def.id];
      for (const r of sec.rows) {
        let d = map.get(r.driverId);
        if (!d) {
          d = {
            driverId: r.driverId,
            name: r.cells[0] ?? "",
            active: rowIsActive(def, r, data),
            status: rowDriverStatus(def, r, data),
            issues: 0,
            phone: "",
            cdl: "",
            state: "",
            valid: 0,
            total: 0,
          };
          map.set(r.driverId, d);
        }
        // Always refresh status from latest row so toggles apply immediately.
        d.active = rowIsActive(def, r, data);
        d.status = rowDriverStatus(def, r, data);
        if (!d.name.trim()) d.name = r.cells[0] ?? "";
        const muted = rowAlertsMuted(def, r, data);
        if (!muted) d.issues += analyzeRow(def, sec.headers, r).issues.length;
        const aidx = def.types.indexOf("active");
        if (aidx >= 0 && !d.statusTarget) d.statusTarget = { sectionId: def.id, rowId: r.id, col: aidx };
        def.types.forEach((t, i) => {
          if (t === "status") {
            d.total++;
            if (normStatus(r.cells[i] ?? "") === "Valid") d.valid++;
          }
          if (t === "state" && !d.state) d.state = (r.cells[i] ?? "").trim();
        });
        if (def.id === "info") d.phone = (r.cells[1] ?? "").trim();
        if (def.id === "ssccdl") d.cdl = (r.cells[1] ?? "").trim();
      }
    }
    return [...map.values()]
      .filter((d) => statusFilter === "all" || d.status === statusFilter)
      .filter((d) => matchesExpFilter(data, d.driverId, exp))
      .filter((d) => (d.name + " " + d.cdl + " " + d.phone).toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" }));
  }, [data, q, statusFilter, exp]);

  const open = drivers.find((d) => d.driverId === openId) ?? null;
  const th = "px-4 py-3 text-left text-xs font-extrabold tracking-wider uppercase";

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search driver, CDL or phone…"
            className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-base"
          />
        </div>
        <div className="inline-flex flex-wrap rounded-xl border-2 bg-card p-1 shadow-card">
          {(["active", "leave", "inactive", "all"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={cn(
                "ui-press rounded-lg px-3 py-1.5 text-sm font-bold capitalize",
                statusFilter === f ? "bg-brand text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <ExpirationFilter value={exp} onChange={setExp} />
      </div>
      <div className="ui-lift ui-row-hover min-h-0 flex-1 overflow-auto rounded-2xl border bg-card shadow-card">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-brand text-primary-foreground">
            <tr>
              <th className={th}>Driver</th>
              <th className={th}>Status</th>
              <th className={th}>CDL</th>
              <th className={th}>Documents</th>
              <th className={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const pct = d.total ? Math.round((d.valid / d.total) * 100) : 0;
              const mute = alertsMuteBanner(d.status);
              return (
                <tr
                  key={d.driverId}
                  id={"driver-" + d.driverId}
                  className={cn(
                    "border-b border-foreground/15 align-top",
                    d.issues > 0 ? "bg-danger-row" : "bg-card",
                    (d.status === "leave" || d.status === "inactive") && "opacity-70",
                  )}
                >
                  <td className={cn("px-4 py-3", d.issues > 0 && "border-l-4 border-l-danger")}>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand font-display font-extrabold text-primary-foreground">
                        {d.name.trim().charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <div data-driver-name className="font-extrabold">{d.name.trim() || "—"}</div>
                        <div className="text-sm text-muted-foreground">{d.phone || "—"}</div>
                        {mute && <div className="mt-1 text-xs font-semibold text-warn">{mute}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {d.statusTarget && !view ? (
                      <ActiveToggle
                        value={formatDriverStatus(d.status)}
                        onSave={(v) => setCell(d.statusTarget!.sectionId, d.statusTarget!.rowId, d.statusTarget!.col, v)}
                      />
                    ) : (
                      <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold", STATUS_BADGE[d.status])}>
                        {formatDriverStatus(d.status)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{d.cdl || "—"}</div>
                    <div className="text-sm text-muted-foreground">{d.state || "—"}</div>
                  </td>
                  <td className="w-64 px-4 py-3">
                    <div className="font-bold">{pct}% complete</div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
                    </div>
                    <div className={cn("mt-1 text-sm font-bold", d.issues ? "text-danger" : "text-ok")}>
                      {d.issues ? `${d.issues} action item${d.issues > 1 ? "s" : ""}` : "All clear"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(d.driverId)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 font-bold hover:border-primary"
                      >
                        <FolderOpen className="size-4" /> Open
                      </button>
                      {!view && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete ${d.name.trim()} from ALL sections? This cannot be undone.`)) deleteDriver(d.driverId);
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          aria-label="Delete driver"
                        >
                          <Trash2 className="size-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!drivers.length && <p className="p-4 text-muted-foreground">No drivers found.</p>}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-3xl [&>button]:hidden"
          // Close only via the header X — no backdrop / edge / Escape dismiss.
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {open && <DriverFile driverId={open.driverId} name={open.name} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DriverFile({ driverId, name }: { driverId: string; name: string }) {
  const data = useData();
  const view = useViewMode();
  const statusInfo = useMemo(() => {
    for (const def of CARD_SECTIONS) {
      const sec = data.sections[def.id];
      const row = sec?.rows.find((r) => r.driverId === driverId);
      if (!row) continue;
      const col = def.types.indexOf("active");
      if (col < 0) continue;
      return { def, row, col, status: rowDriverStatus(def, row, data) };
    }
    return null;
  }, [data, driverId]);
  const mute = statusInfo ? alertsMuteBanner(statusInfo.status) : null;

  return (
    <>
      <div className="relative bg-brand px-6 py-5 pr-16 text-primary-foreground">
        <SheetClose
          type="button"
          aria-label="Close driver file"
          className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground shadow-card transition hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/80"
        >
          <X className="size-5 stroke-[2.5]" aria-hidden />
          <span className="sr-only">Close</span>
        </SheetClose>
        <div className="text-xs font-extrabold tracking-widest uppercase opacity-90">Driver file</div>
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-primary-foreground">{name.trim()}</SheetTitle>
          <SheetDescription className="text-primary-foreground/90">
            All documents in one place. Changes here are the same as editing in each section.
          </SheetDescription>
        </SheetHeader>
        {statusInfo && (
          <div className="mt-4 rounded-xl bg-primary-foreground/10 p-3">
            <div className="mb-2 text-xs font-extrabold tracking-widest uppercase opacity-90">Employment status</div>
            {view ? (
              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-sm font-bold", STATUS_BADGE[statusInfo.status])}>
                {formatDriverStatus(statusInfo.status)}
              </span>
            ) : (
              <ActiveToggle
                value={formatDriverStatus(statusInfo.status)}
                onSave={(v) => setCell(statusInfo.def.id, statusInfo.row.id, statusInfo.col, v)}
              />
            )}
          </div>
        )}
      </div>
      {mute && (
        <div className="border-b border-warn/30 bg-warn-soft px-6 py-3 text-sm font-bold text-warn" role="status">
          {mute}
        </div>
      )}
      <div className="space-y-4 px-6 py-5">
        {CARD_SECTIONS.map((def) => {
          const sec = data.sections[def.id];
          const row = sec.rows.find((r) => r.driverId === driverId);
          return (
            <section key={def.id} className="rounded-xl border">
              <h3 className="border-b bg-muted px-4 py-2 font-display text-base font-extrabold">{def.title}</h3>
              {row ? (
                <SectionFields sectionId={def.id} row={row} />
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground italic">Not in this section.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function planExpiryCol(sectionId: string, planCol: number) {
  if (sectionId !== "queries") return -1;
  if (planCol === 6) return 2; // Annual Query Future Plan ← Annual Exp
  if (planCol === 7) return 4; // Pre-Employment Future Plan ← Pre-Emp Exp
  return -1;
}

function PlanSuggestChip({ suggestion, onApply }: { suggestion: string; onApply: () => void }) {
  return (
    <button
      type="button"
      onClick={onApply}
      title="Click to fill this suggested apply date (you can still type freely)"
      className="mt-1 inline-flex max-w-full items-center rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-left text-xs font-semibold text-primary transition hover:bg-primary/20"
    >
      <span className="truncate">Suggest: {suggestion}</span>
    </button>
  );
}

function SectionFields({ sectionId, row }: { sectionId: string; row: Row }) {
  const data = useData();
  const def = SECTIONS.find((s) => s.id === sectionId)!;
  const headers = data.sections[sectionId].headers;
  const { cellTone } = analyzeRow(def, headers, row);
  return (
    <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2">
      {def.types.map((t, i) => {
        if (t === "name") return null;
        const v = row.cells[i] ?? "";
        const tone = cellTone[i];
        const save = (nv: string) => {
          if (nv !== v) setCell(sectionId, row.id, i, nv);
        };
        const wide = t === "note" || t === "plan" || t === "tempnote";
        const expiryIdx = t === "plan" ? planExpiryCol(sectionId, i) : -1;
        const suggestion = expiryIdx >= 0 ? suggestApplyPlan(row.cells[expiryIdx] ?? "") : null;
        return (
          <div key={i} className={cn(wide && "sm:col-span-2")}>
            <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{headers[i]?.trim()}</div>
            {(t === "text" || t === "state") && <EditableText value={v} onSave={save} boxed tone={tone} />}
            {t === "secret" && <EditableText value={v} onSave={save} mask boxed tone={tone} />}
            {(t === "note" || t === "plan" || t === "tempnote") && (
              <div>
                <EditableText
                  value={v}
                  onSave={save}
                  boxed
                  tone={tone}
                  placeholder={
                    t === "plan"
                      ? "Add future plan"
                      : t === "tempnote"
                        ? "Add temporary reminder (never highlights)"
                        : "Add note"
                  }
                />
                {suggestion && <PlanSuggestChip suggestion={suggestion} onApply={() => save(suggestion)} />}
              </div>
            )}
            {t === "date" && <DateCell value={v} onSave={save} tone={tone} />}
            {t === "status" && <StatusToggle value={v} options={def.statusOptions} onSave={save} />}
            {t === "active" && <ActiveToggle value={v} onSave={save} />}
            {t === "score" && <div className="font-display text-lg font-extrabold">{complianceScore(row)}%</div>}
          </div>
        );
      })}
    </div>
  );
}
