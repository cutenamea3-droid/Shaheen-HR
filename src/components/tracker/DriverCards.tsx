import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, FolderOpen, Trash2, X, Printer } from "lucide-react";
import { toast } from "sonner";
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
  statusExpiryCol,
  type ExpFilter,
} from "@/lib/alerts";
import { suggestPlanForCell } from "@/lib/plan-dates";
import { countTempNotes, listScopeOf, matchesListScope, type ListScope } from "@/lib/driver-meta";
import { dateOfHireOf, formatHireDateDisplay, lengthOfService } from "@/lib/driver-hr/hire-date";
import { printDriverDossier } from "@/lib/driver-dossier";
import { deleteDriver, setCell, useData } from "@/lib/store";
import { useDensity } from "@/lib/density";
import { loadDriverCardsPrefs, saveDriverCardsPrefs } from "@/lib/uiprefs";
import { useViewMode } from "@/lib/viewmode";
import { ActiveToggle, DateCell, EditableText, StatusToggle } from "./cells";
import { DensityToggle } from "./DensityToggle";
import { ExpirationFilter } from "./ExpirationFilter";
import { FilterGroup, FilterRack } from "./FilterRack";
import { FuturePlanSuggest } from "./FuturePlanSuggest";
import { ListScopeFilter } from "./ListScopeFilter";
import { TempNotesBadge } from "./TempNotesBadge";
import { DriverManageControls } from "./DriverManageControls";
import { DrugTestRegister } from "./driver-hr/DrugTestRegister";
import { HireDateField } from "./driver-hr/HireDateField";
import { RateCardPanel } from "./driver-hr/RateCardPanel";

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
  scope: ListScope;
  /** Section/row/col to write employment status from the cards list. */
  statusTarget?: { sectionId: string; rowId: string; col: number };
}

type StatusFilter = "active" | "leave" | "inactive" | "all";

const STATUS_BADGE: Record<DriverStatus, string> = {
  active: "bg-ok-soft text-ok",
  leave: "bg-warn-soft text-warn",
  inactive: "bg-muted text-muted-foreground",
};

export function DriverCards({
  focusDriver,
  initialScope,
  initialExp,
  initialTempNotes,
}: {
  focusDriver?: string | undefined;
  initialScope?: ListScope;
  initialExp?: ExpFilter;
  initialTempNotes?: boolean;
} = {}) {
  const data = useData();
  const navigate = useNavigate();
  const prefs = loadDriverCardsPrefs();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>(() => prefs.statusFilter ?? "active");
  const [listScope, setListScopeState] = useState<ListScope>(() => initialScope ?? prefs.listScope ?? "company");
  const [exp, setExpState] = useState<ExpFilter>(() => initialExp ?? prefs.exp ?? "all");
  const [tempNotesOnly, setTempNotesOnlyState] = useState(() => initialTempNotes ?? prefs.tempNotesOnly ?? false);
  const setStatusFilter = (v: StatusFilter) => {
    setStatusFilterState(v);
    saveDriverCardsPrefs({ statusFilter: v });
  };
  const setListScope = (v: ListScope) => {
    setListScopeState(v);
    saveDriverCardsPrefs({ listScope: v, tempNotesOnly: false });
    setTempNotesOnlyState(false);
  };
  const setExp = (v: ExpFilter) => {
    setExpState(v);
    saveDriverCardsPrefs({ exp: v });
  };
  const setTempNotesOnly = (v: boolean) => {
    setTempNotesOnlyState(v);
    saveDriverCardsPrefs({ tempNotesOnly: v, ...(v ? { statusFilter: "all" as const, exp: "all" as const } : {}) });
    if (v) {
      setStatusFilterState("all");
      setExpState("all");
    }
  };
  const view = useViewMode();
  const density = useDensity();
  const [openId, setOpenId] = useState<string | null>(null);

  // Deep-link from Daily Summary chips (scope / exp / temp notes).
  useEffect(() => {
    if (initialScope) setListScopeState(initialScope);
    if (initialExp) setExpState(initialExp);
    if (initialTempNotes != null) setTempNotesOnlyState(initialTempNotes);
  }, [initialScope, initialExp, initialTempNotes]);

  const allDrivers = useMemo(() => {
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
            scope: listScopeOf(data, r.driverId),
          };
          map.set(r.driverId, d);
        }
        // Always refresh status from latest row so toggles apply immediately.
        d.active = rowIsActive(def, r, data);
        d.status = rowDriverStatus(def, r, data);
        d.scope = listScopeOf(data, r.driverId);
        if (!d.name.trim()) d.name = r.cells[0] ?? "";
        // Issue counts only for ordinary company lists (New/OO have dedicated scopes).
        const muted = rowAlertsMuted(def, r, data) || d.scope !== "company";
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
    return [...map.values()].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" }));
  }, [data]);

  const scopeCounts = useMemo(() => {
    const c: Record<ListScope, number> = { company: 0, owner_operator: 0, new: 0 };
    for (const d of allDrivers) c[d.scope]++;
    return c;
  }, [allDrivers]);

  const drivers = useMemo(() => {
    return allDrivers
      .filter((d) => matchesListScope(data, d.driverId, listScope))
      // Show all / Active / Leave / Inactive never include New when viewing company or OO.
      .filter((d) => {
        if (listScope === "new") return true;
        if (statusFilter === "all") return true;
        return d.status === statusFilter;
      })
      .filter((d) => matchesExpFilter(data, d.driverId, exp))
      // Temp notes filter is UI-only — never an issue/alert category.
      .filter((d) => !tempNotesOnly || countTempNotes(data, d.driverId) > 0)
      .filter((d) => (d.name + " " + d.cdl + " " + d.phone).toLowerCase().includes(q.trim().toLowerCase()));
  }, [allDrivers, data, q, statusFilter, listScope, exp, tempNotesOnly]);

  // Quick Find / deep link: clear filters, open sheet, scroll+flash the row.
  useEffect(() => {
    if (!focusDriver) return;
    setStatusFilter("all");
    setListScope(listScopeOf(data, focusDriver));
    setExp("all");
    setQ("");
    setOpenId(focusDriver);
    const t = setTimeout(() => {
      const el = document.getElementById("driver-" + focusDriver);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("animate-flash");
        void (el as HTMLElement).offsetWidth;
        el.classList.add("animate-flash");
      }
      void navigate({ to: "/drivers", search: { driver: undefined }, replace: true });
    }, 150);
    return () => clearTimeout(t);
  }, [focusDriver, navigate]);

  const open = allDrivers.find((d) => d.driverId === openId) ?? null;
  const th = "px-4 py-3 text-left text-xs font-extrabold tracking-wider uppercase";

  return (
    <div className={cn("flex h-full flex-col overflow-hidden px-3 py-3 sm:p-5", density === "compact" ? "gap-2" : "gap-4")}>
      <div className="tracker-no-print tracker-toolbar">
        <div className="relative max-w-md min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search driver, CDL or phone…"
            className="tracker-search"
            aria-label="Search drivers"
          />
        </div>
        <FilterRack>
          <FilterGroup label="Scope">
            <ListScopeFilter value={listScope} onChange={setListScope} counts={scopeCounts} />
          </FilterGroup>
          {listScope !== "new" && (
            <FilterGroup label="Employment">
              <div className="tracker-filter-group" role="group" aria-label="Driver employment filter">
                {(["active", "leave", "inactive", "all"] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    aria-pressed={statusFilter === f}
                    className={cn("tracker-filter-btn ui-press capitalize", statusFilter === f && "tracker-filter-btn-on")}
                  >
                    {f === "all" ? "Show all" : f}
                  </button>
                ))}
              </div>
            </FilterGroup>
          )}
          <FilterGroup label="Reminders">
            <div className="tracker-filter-group" role="group" aria-label="Temporary notes filter">
              <button
                type="button"
                onClick={() => setTempNotesOnly(false)}
                aria-pressed={!tempNotesOnly}
                className={cn("tracker-filter-btn", !tempNotesOnly && "tracker-filter-btn-on")}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTempNotesOnly(true)}
                aria-pressed={tempNotesOnly}
                title="Show drivers with temporary notes — reminders only, never issues"
                className={cn("tracker-filter-btn", tempNotesOnly && "tracker-filter-btn-on")}
              >
                Temp notes
              </button>
            </div>
          </FilterGroup>
          <FilterGroup label="Density">
            <DensityToggle />
          </FilterGroup>
        </FilterRack>
        <ExpirationFilter value={exp} onChange={setExp} />
      </div>
      <div className="ui-lift ui-row-hover tracker-table-wrap">
        <table className={cn("w-full min-w-[640px] border-collapse", density === "compact" && "tracker-table-compact")}>
          <thead className="sticky top-0 z-10 bg-brand text-primary-foreground">
            <tr>
              <th className={th}>Driver</th>
              <th className={th}>Status</th>
              <th className={th}>CDL</th>
              <th className={th}>Hire</th>
              <th className={th}>Documents</th>
              <th className={cn(th, "tracker-no-print")}>Action</th>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div data-driver-name className="font-extrabold">{d.name.trim() || "—"}</div>
                          <TempNotesBadge driverId={d.driverId} />
                          {d.scope === "owner_operator" && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                              Owner Op
                            </span>
                          )}
                          {d.scope === "new" && (
                            <span className="rounded-md bg-info/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-info uppercase">
                              New
                            </span>
                          )}
                        </div>
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
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold", STATUS_BADGE[d.status])}>
                        <span className={cn("tracker-status-dot", d.status === "active" ? "bg-ok" : d.status === "leave" ? "bg-warn" : "bg-muted-foreground")} aria-hidden />
                        {formatDriverStatus(d.status)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{d.cdl || "—"}</div>
                    <div className="text-sm text-muted-foreground">{d.state || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const hire = dateOfHireOf(data, d.driverId);
                      const los = lengthOfService(hire);
                      return (
                        <>
                          <div className="font-semibold">{hire ? formatHireDateDisplay(hire) : "—"}</div>
                          {los && <div className="text-sm text-muted-foreground">{los.label}</div>}
                        </>
                      );
                    })()}
                  </td>
                  <td className="w-64 px-4 py-3">
                    <div className="font-bold">{pct}% complete</div>
                    <div className="tracker-doc-bar mt-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Documents complete">
                      <div className="tracker-doc-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className={cn("mt-1 text-sm font-bold", d.issues ? "text-danger" : "text-ok")}>
                      {d.issues ? `${d.issues} action item${d.issues > 1 ? "s" : ""}` : "All clear"}
                    </div>
                  </td>
                  <td className="tracker-no-print px-4 py-3">
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
          {open && <DriverFile driverId={open.driverId} name={open.name} cdl={open.cdl} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DriverFile({ driverId, name, cdl }: { driverId: string; name: string; cdl: string }) {
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
          className="tracker-no-print absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground shadow-card transition hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/80"
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
        <div className="tracker-no-print mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (printDriverDossier(data, driverId)) toast.success("Print dossier opened");
              else toast.error("Allow pop-ups to print the dossier");
            }}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground/40 bg-primary-foreground/15 px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-foreground/25"
          >
            <Printer className="size-4" /> Print Dossier
          </button>
        </div>
        <p className="mt-2 hidden text-sm text-primary-foreground/90 print:block">
          CDL {cdl || "—"}
        </p>
        {statusInfo && (
          <div className="tracker-manage-panel mt-4">
            <div className="tracker-manage-title mb-2">Employment status</div>
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
        <DriverManageControls driverId={driverId} name={name} />
      </div>
      {mute && (
        <div className="border-b border-warn/30 bg-warn-soft px-6 py-3 text-sm font-bold text-warn" role="status">
          {mute}
        </div>
      )}
      <div className="space-y-4 px-6 py-5">
        <HireDateField driverId={driverId} />
        <RateCardPanel driverId={driverId} />
        <DrugTestRegister driverId={driverId} driverName={name} />
        {CARD_SECTIONS.map((def) => {
          const sec = data.sections[def.id];
          const row = sec.rows.find((r) => r.driverId === driverId);
          return (
            <section key={def.id} className="tracker-profile-section">
              <h3 className="tracker-profile-section-h">{def.title}</h3>
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
        const planSuggestion = t === "plan" ? suggestPlanForCell(sectionId, i, row) : null;
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
                {t === "plan" && (
                  <div className="mt-2">
                    <FuturePlanSuggest
                      suggestion={planSuggestion}
                      existingPlan={v}
                      sectionId={sectionId}
                      rowId={row.id}
                      planCol={i}
                      compact
                    />
                  </div>
                )}
              </div>
            )}
            {t === "date" && (
              <DateCell
                value={v}
                onSave={save}
                tone={tone}
                appliedStatus={
                  def.types.findIndex((x, idx) => x === "status" && statusExpiryCol(sectionId, idx) === i) >= 0
                    ? row.cells[
                        def.types.findIndex((x, idx) => x === "status" && statusExpiryCol(sectionId, idx) === i)
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
                  const exp = statusExpiryCol(sectionId, i);
                  return exp != null ? row.cells[exp] : undefined;
                })()}
              />
            )}
            {t === "active" && <ActiveToggle value={v} onSave={save} />}
            {t === "score" && <div className="font-display text-lg font-extrabold">{complianceScore(row)}%</div>}
          </div>
        );
      })}
    </div>
  );
}
