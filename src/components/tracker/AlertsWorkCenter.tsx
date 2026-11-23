import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

/** Quiet left accent — avoids full red card frames. */
const TONE_ACCENT: Record<Tone, string> = {
  danger: "border-l-danger",
  warn: "border-l-warn",
  info: "border-l-info",
  note: "border-l-gold",
  ok: "border-l-ok",
  sign: "border-l-sign",
  muted: "border-l-border",
};

const TONE_DOT: Record<Tone, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-info",
  note: "bg-gold",
  ok: "bg-ok",
  sign: "bg-sign",
  muted: "bg-muted-foreground",
};

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

function DriverCard({
  driverId,
  driver,
  isNew,
  items,
  defaultOpen,
}: {
  driverId: string;
  driver: string;
  isNew: boolean;
  items: WorkCenterItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const worst = items[0]?.tone ?? "muted";

  return (
    <article
      className={cn(
        "rounded-lg border border-border border-l-4 bg-card",
        TONE_ACCENT[worst],
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-base font-bold text-foreground">{driver}</h2>
            {isNew && (
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                New
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {items.length} issue{items.length === 1 ? "" : "s"}
            </span>
          </div>
          {!open && (
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {items.slice(0, 3).map((i) => (
                <li key={i.key} className="truncate">
                  <span className="font-medium text-foreground">{i.docType}</span>
                  {" — "}
                  {i.details}
                </li>
              ))}
              {items.length > 3 && <li>+{items.length - 3} more</li>}
            </ul>
          )}
        </div>
        <Link
          to="/drivers"
          search={{ driver: driverId }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Full record
        </Link>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          {items.map((item) => (
            <div
              key={item.key}
              className={cn(
                "rounded-md border border-border border-l-4 bg-background/60 p-3",
                TONE_ACCENT[item.tone],
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn("inline-block size-2 shrink-0 rounded-full", TONE_DOT[item.tone])}
                      aria-hidden
                    />
                    <span className="font-semibold text-foreground">{item.docType}</span>
                    <span className="text-xs text-muted-foreground">{item.sectionTitle}</span>
                  </div>
                  <p className="mt-1.5 text-[15px] text-foreground">{item.details}</p>
                  <dl className="mt-2 grid gap-0.5 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>
                      <span className="font-medium text-foreground">Status: </span>
                      {item.statusLabel}
                      {item.dmvApplied ? " (DMV Applied)" : ""}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Expiry / due: </span>
                      {item.expiryDisplay}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Days: </span>
                      {item.daysLabel}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="font-medium text-foreground">Needed action: </span>
                      {item.neededAction}
                    </div>
                    {item.planSuggestion?.leadDays != null && item.kind === "plan" && (
                      <div className="sm:col-span-2">
                        Lead {item.planSuggestion.leadDays}d · Reminder{" "}
                        {item.planSuggestion.reminderLabel ?? "—"}
                      </div>
                    )}
                  </dl>
                </div>
                <Link
                  to="/s/$sectionId"
                  params={{ sectionId: item.sectionId }}
                  search={{ row: item.rowId }}
                  className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  View in section
                </Link>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Edit / Update
                </div>
                <ItemEditor item={item} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
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
    <div className="w-full min-w-0 max-w-none space-y-3 text-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-foreground">My Compliance Today</h1>
          <p className="text-sm text-muted-foreground">
            {counts.drivers} drivers · {counts.all} alerts
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
            <div className="rounded-lg border border-border px-4 py-6 text-center">
              <p className="font-semibold text-foreground">All clear for this filter</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No drivers need attention here. Try All or clear search.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g, idx) => (
                <DriverCard
                  key={g.driverId}
                  driverId={g.driverId}
                  driver={g.driver}
                  isNew={g.isNew}
                  items={g.items}
                  defaultOpen={idx < 3 || g.items.length <= 2}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
