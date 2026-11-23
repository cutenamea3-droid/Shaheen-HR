import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import {
  WORK_CENTER_FILTERS,
  collectWorkCenterItems,
  filterWorkCenterItems,
  groupWorkCenterByDriver,
  sectionStatusOptions,
  workCenterCounts,
  type WorkCenterFilter,
  type WorkCenterItem,
} from "@/lib/alerts-work-center";
import { setCell, useData } from "@/lib/store";
import { SECTIONS, cellsOf, rowsOf } from "@/lib/sections";
import { suggestPlanForCell } from "@/lib/plan-dates";
import { DateCell, EditableText, StatusToggle } from "./cells";
import { FuturePlanSuggest } from "./FuturePlanSuggest";
import { DriverManageControls } from "./DriverManageControls";
import { FollowUpTracker } from "./FollowUpTracker";
import { PlanCalendar } from "./PlanCalendar";
import { DataQualityReview } from "./DataQualityReview";
import { InspectionReadinessPanel } from "./InspectionReadinessPanel";
import { ComplianceHistoryPanel } from "./ComplianceHistoryPanel";
import { FileCompletenessPanel } from "./FileCompletenessPanel";
import type { Tone } from "@/lib/alerts";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

type WorkCenterTab =
  | "today"
  | "followups"
  | "calendar"
  | "data_quality"
  | "inspection"
  | "history"
  | "completeness";

/** Secondary tools — not equal-weight pills competing with Today. */
const TOOL_TABS: { id: Exclude<WorkCenterTab, "today">; label: string }[] = [
  { id: "followups", label: "Follow-Up Tracker" },
  { id: "calendar", label: "Future Plan Calendar" },
  { id: "data_quality", label: "Data Quality" },
  { id: "inspection", label: "Inspection Readiness" },
  { id: "history", label: "Compliance History" },
  { id: "completeness", label: "File Completeness" },
];

/** Severity as text for dark-mode scan — avoid colored card chrome. */
const TONE_LABEL: Record<Tone, string> = {
  danger: "Urgent",
  warn: "Soon",
  info: "Info",
  note: "Note",
  ok: "OK",
  sign: "Sign",
  muted: "",
};

/** Medical first (owner scan path), then other sections alphabetically. */
function sectionSortKey(section: string): string {
  const s = section.trim().toLowerCase();
  if (s === "medical" || s.startsWith("medical")) return `0-${s}`;
  return `1-${s}`;
}

function groupItemsBySection(items: WorkCenterItem[]): { section: string; items: WorkCenterItem[] }[] {
  const map = new Map<string, WorkCenterItem[]>();
  for (const item of items) {
    const section = asText(item.sectionTitle) || asText(item.docType) || "Other";
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => sectionSortKey(a).localeCompare(sectionSortKey(b)))
    .map(([section, sectionItems]) => ({ section, items: sectionItems }));
}

function safeSave(
  sectionId: string,
  rowId: string,
  col: number,
  value: string,
  previous: string,
  label: string,
) {
  try {
    if (value === previous) return;
    setCell(sectionId, rowId, col, value);
    toast.success(`${label} saved`);
  } catch (e) {
    toast.error(`Could not save ${label}`, {
      description: e instanceof Error ? e.message : "Original value kept — retry from the editor",
    });
  }
}

function ItemEditor({ item }: { item: WorkCenterItem }) {
  const data = useData();
  const rawRow = rowsOf(data.sections[item.sectionId]).find((r) => r.id === item.rowId);
  const row = rawRow ? { ...rawRow, cells: cellsOf(rawRow) } : undefined;
  if (!row) {
    return <p className="text-sm font-semibold text-muted-foreground">Row missing — refresh or open full record.</p>;
  }

  const def = SECTIONS.find((s) => s.id === item.sectionId);
  const statusOpts = sectionStatusOptions(item.sectionId);
  const liveSuggestion =
    item.planCol != null ? suggestPlanForCell(item.sectionId, item.planCol, row) : item.planSuggestion;

  if (item.linkOnly && item.kind !== "new_driver") {
    return (
      <p className="text-sm text-muted-foreground">
        {asText(item.linkOnly.reason)}.{" "}
        {item.linkOnly.to === "/drivers" ? (
          <Link to="/drivers" search={{ driver: item.driverId }} className="font-semibold text-primary underline">
            {asText(item.linkOnly.label)}
          </Link>
        ) : (
          <Link
            to="/s/$sectionId"
            params={{ sectionId: item.sectionId }}
            search={{ row: item.rowId }}
            className="font-semibold text-primary underline"
          >
            {asText(item.linkOnly.label)}
          </Link>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {item.kind === "new_driver" && (
        <div className="rounded-md border border-border bg-card p-3">
          <DriverManageControls driverId={item.driverId} name={item.driver} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {item.statusCol != null && statusOpts.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Status</div>
            <StatusToggle
              value={row.cells[item.statusCol] ?? ""}
              options={statusOpts}
              onSave={(v) =>
                safeSave(item.sectionId, item.rowId, item.statusCol!, v, row.cells[item.statusCol!] ?? "", "Status")
              }
              expiryValue={item.dateCol != null ? row.cells[item.dateCol] : undefined}
            />
          </div>
        )}
        {item.dateCol != null && def?.types[item.dateCol] === "date" && (
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Expiry / due
            </div>
            <DateCell
              value={row.cells[item.dateCol] ?? ""}
              onSave={(v) =>
                safeSave(item.sectionId, item.rowId, item.dateCol!, v, row.cells[item.dateCol!] ?? "", "Expiry date")
              }
              appliedStatus={item.statusCol != null ? row.cells[item.statusCol] : undefined}
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              Changing expiry recalculates the Future Plan suggestion (saved plan unchanged).
            </p>
          </div>
        )}
      </div>

      {item.planCol != null && (
        <div>
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Future Plan (manual edit)
          </div>
          <EditableText
            value={row.cells[item.planCol] ?? ""}
            onSave={(v) =>
              safeSave(item.sectionId, item.rowId, item.planCol!, v, row.cells[item.planCol!] ?? "", "Future Plan")
            }
            boxed
            placeholder="Add future plan"
          />
          <div className="mt-2">
            <FuturePlanSuggest
              suggestion={liveSuggestion}
              existingPlan={row.cells[item.planCol] ?? ""}
              sectionId={item.sectionId}
              rowId={item.rowId}
              planCol={item.planCol}
            />
          </div>
        </div>
      )}

      {item.tempnoteCol != null && (item.kind === "tempnote" || item.existingTempNote) && (
        <div>
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Temporary Note (no due date)
          </div>
          <EditableText
            value={row.cells[item.tempnoteCol] ?? ""}
            onSave={(v) =>
              safeSave(
                item.sectionId,
                item.rowId,
                item.tempnoteCol!,
                v,
                row.cells[item.tempnoteCol!] ?? "",
                "Temporary Note",
              )
            }
            boxed
            placeholder="Temporary reminder — never invents a due date"
          />
        </div>
      )}

      {item.dmvApplied && (
        <p className="text-sm text-muted-foreground">
          DMV Applied — expiry countdown stays visible. Do not mark Valid until the pull notice is renewed.
        </p>
      )}
    </div>
  );
}

/**
 * Dark-mode friendly scan block:
 * Driver heading → section groups (Medical, DMV, …) → next driver.
 * Minimal chrome — no nested colored cards.
 */
function DriverCard({
  driverId,
  driver,
  isNew,
  items,
}: {
  driverId: string;
  driver: string;
  isNew: boolean;
  items: WorkCenterItem[];
}) {
  const [open, setOpen] = useState(true);
  const sections = useMemo(() => groupItemsBySection(items), [items]);

  return (
    <section className="compliance-today-driver border-b border-border/70 pb-5 last:border-b-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-baseline gap-2 text-left"
          aria-expanded={open}
        >
          <span className="text-muted-foreground">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{driver}</h2>
          {isNew && (
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              New
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {items.length} issue{items.length === 1 ? "" : "s"}
          </span>
        </button>
        <Link
          to="/drivers"
          search={{ driver: driverId }}
          className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Full record
        </Link>
      </header>

      {open && (
        <div className="space-y-4 pl-1 sm:pl-6">
          {sections.map(({ section, items: sectionItems }) => (
            <div key={section} className="space-y-2">
              <h3 className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {section}
              </h3>
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {sectionItems.map((item) => (
                  <li key={item.key} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-foreground">{item.docType}</span>
                          {TONE_LABEL[item.tone] ? (
                            <span className="text-xs font-medium text-muted-foreground">
                              {TONE_LABEL[item.tone]}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[15px] leading-snug text-foreground/90">{item.details}</p>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          <span className="text-foreground/80">{item.statusLabel}</span>
                          {item.dmvApplied ? " · DMV Applied" : ""}
                          {" · "}
                          {item.expiryDisplay}
                          {" · "}
                          {item.daysLabel}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">Action: </span>
                          {item.neededAction}
                        </p>
                      </div>
                      <Link
                        to="/s/$sectionId"
                        params={{ sectionId: item.sectionId }}
                        search={{ row: item.rowId }}
                        className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                    <div className="mt-3">
                      <ItemEditor item={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AlertsWorkCenter() {
  const data = useData();
  const [tab, setTab] = useState<WorkCenterTab>("today");
  const [filter, setFilter] = useState<WorkCenterFilter>("all");
  const [search, setSearch] = useState("");

  const items = useMemo(() => collectWorkCenterItems(data), [data]);
  const filtered = useMemo(() => filterWorkCenterItems(items, filter, search), [items, filter, search]);
  const groups = useMemo(() => groupWorkCenterByDriver(filtered), [filtered]);
  const counts = useMemo(() => workCenterCounts(items), [items]);

  return (
    <div className="compliance-today-page w-full min-w-0 max-w-none space-y-4 text-[15px] text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground">My Compliance Today</h1>
          <p className="text-sm text-muted-foreground">
            {counts.drivers} drivers · {counts.all} alerts · scan by driver
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Work center tools</span>
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as WorkCenterTab)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary"
            aria-label="Work center tools"
          >
            <option value="today">My Compliance Today</option>
            {TOOL_TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tab === "followups" && <FollowUpTracker />}
      {tab === "calendar" && <PlanCalendar />}
      {tab === "data_quality" && <DataQualityReview />}
      {tab === "inspection" && <InspectionReadinessPanel />}
      {tab === "history" && <ComplianceHistoryPanel />}
      {tab === "completeness" && <FileCompletenessPanel />}

      {tab === "today" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[12rem] flex-1 items-center gap-2 sm:max-w-xs">
              <span className="sr-only">Filter alerts</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as WorkCenterFilter)}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground outline-none focus:border-primary"
                aria-label="Filter alerts"
              >
                {WORK_CENTER_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({counts[f.id]})
                  </option>
                ))}
              </select>
            </label>
            <div className="relative min-w-[12rem] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search driver or document…"
                className="h-9 w-full rounded-md border border-border bg-card py-1.5 pr-3 pl-9 text-sm outline-none focus:border-primary"
                aria-label="Search alerts"
              />
            </div>
          </div>

          {!groups.length ? (
            <div className="border-y border-border/70 px-1 py-8 text-center">
              <p className="font-semibold text-foreground">All clear for this filter</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No drivers need attention here. Try All or clear search.
              </p>
            </div>
          ) : (
            <div className="compliance-today-scan space-y-1 pt-1">
              {groups.map((g) => (
                <DriverCard
                  key={g.driverId}
                  driverId={g.driverId}
                  driver={g.driver}
                  isNew={g.isNew}
                  items={g.items}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
