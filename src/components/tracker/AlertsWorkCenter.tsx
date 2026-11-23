import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/alerts";
import { Chip, DateCell, EditableText, StatusToggle } from "./cells";
import { FuturePlanSuggest } from "./FuturePlanSuggest";
import { DriverManageControls } from "./DriverManageControls";
import { FollowUpTracker } from "./FollowUpTracker";
import { PlanCalendar } from "./PlanCalendar";
import { DataQualityReview } from "./DataQualityReview";
import { InspectionReadinessPanel } from "./InspectionReadinessPanel";
import { ComplianceHistoryPanel } from "./ComplianceHistoryPanel";
import { FileCompletenessPanel } from "./FileCompletenessPanel";

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

const DETAIL_KEY = "shaheen-compliance-today-detail";

type WorkCenterTab =
  "today" | "followups" | "calendar" | "data_quality" | "inspection" | "history" | "completeness";

/** Secondary tools — not equal-weight pills competing with Today. */
const TOOL_TABS: { id: Exclude<WorkCenterTab, "today">; label: string }[] = [
  { id: "followups", label: "Follow-Up Tracker" },
  { id: "calendar", label: "Future Plan Calendar" },
  { id: "data_quality", label: "Data Quality" },
  { id: "inspection", label: "Inspection Readiness" },
  { id: "history", label: "Compliance History" },
  { id: "completeness", label: "File Completeness" },
];

/** Compact status badge labels — never large bars. */
const TONE_LABEL: Record<Tone, string> = {
  danger: "Urgent",
  warn: "Expiring",
  info: "Pending",
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

function groupItemsBySection(
  items: WorkCenterItem[],
): { section: string; items: WorkCenterItem[] }[] {
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

function readDetailMode(): "compact" | "detailed" {
  try {
    return localStorage.getItem(DETAIL_KEY) === "detailed" ? "detailed" : "compact";
  } catch {
    return "compact";
  }
}

function writeDetailMode(v: "compact" | "detailed") {
  try {
    localStorage.setItem(DETAIL_KEY, v);
  } catch {
    /* ignore */
  }
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
    return (
      <p className="text-sm font-semibold text-muted-foreground">
        Row missing — refresh or open full record.
      </p>
    );
  }

  const def = SECTIONS.find((s) => s.id === item.sectionId);
  const statusOpts = sectionStatusOptions(item.sectionId);
  const liveSuggestion =
    item.planCol != null
      ? suggestPlanForCell(item.sectionId, item.planCol, row)
      : item.planSuggestion;

  if (item.linkOnly && item.kind !== "new_driver") {
    return (
      <p className="text-sm text-muted-foreground">
        {asText(item.linkOnly.reason)}.{" "}
        {item.linkOnly.to === "/drivers" ? (
          <Link
            to="/drivers"
            search={{ driver: item.driverId }}
            className="font-semibold text-primary underline"
          >
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
    <div className="space-y-3" data-compliance-today-editor>
      {item.kind === "new_driver" && (
        <div className="rounded-md border border-border bg-card p-3">
          <DriverManageControls driverId={item.driverId} name={item.driver} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {item.statusCol != null && statusOpts.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Status
            </div>
            <StatusToggle
              value={row.cells[item.statusCol] ?? ""}
              options={statusOpts}
              onSave={(v) =>
                safeSave(
                  item.sectionId,
                  item.rowId,
                  item.statusCol!,
                  v,
                  row.cells[item.statusCol!] ?? "",
                  "Status",
                )
              }
              expiryValue={item.dateCol != null ? row.cells[item.dateCol] : undefined}
            />
          </div>
        )}
        {item.dateCol != null && def?.types[item.dateCol] === "date" && (
          <div>
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Expiry / due
            </div>
            <DateCell
              value={row.cells[item.dateCol] ?? ""}
              onSave={(v) =>
                safeSave(
                  item.sectionId,
                  item.rowId,
                  item.dateCol!,
                  v,
                  row.cells[item.dateCol!] ?? "",
                  "Expiry date",
                )
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
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Future Plan (manual edit)
          </div>
          <EditableText
            value={row.cells[item.planCol] ?? ""}
            onSave={(v) =>
              safeSave(
                item.sectionId,
                item.rowId,
                item.planCol!,
                v,
                row.cells[item.planCol!] ?? "",
                "Future Plan",
              )
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
              compact
            />
          </div>
        </div>
      )}

      {item.tempnoteCol != null && (item.kind === "tempnote" || item.existingTempNote) && (
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
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
          DMV Applied — expiry countdown stays visible. Do not mark Valid until the pull notice is
          renewed.
        </p>
      )}
    </div>
  );
}

function DocIssueRow({ item, detailed }: { item: WorkCenterItem; detailed: boolean }) {
  const [editOpen, setEditOpen] = useState(detailed);
  useEffect(() => {
    setEditOpen(detailed);
  }, [detailed, item.key]);

  const toneLabel = TONE_LABEL[item.tone];
  const savedPlan = asText(item.existingPlan).trim();

  return (
    <li className="compliance-today-doc py-3" data-tone={item.tone}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-semibold tracking-tight text-foreground">
              {item.docType}
            </span>
            {toneLabel ? (
              <Chip tone={item.tone} className="rounded-md px-1.5 py-0.5 text-[11px] font-bold">
                {toneLabel}
              </Chip>
            ) : null}
            {item.dmvApplied ? (
              <Chip tone="info" className="rounded-md px-1.5 py-0.5 text-[11px] font-bold">
                DMV Applied
              </Chip>
            ) : null}
          </div>

          <dl className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="inline text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Status{" "}
              </dt>
              <dd className="inline font-medium text-foreground">{item.statusLabel}</dd>
            </div>
            <div className="min-w-0">
              <dt className="inline text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Expiry / due{" "}
              </dt>
              <dd className="inline font-medium text-foreground">
                {item.expiryDisplay}
                <span className="text-muted-foreground"> · {item.daysLabel}</span>
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="inline text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Saved plan{" "}
              </dt>
              <dd className="inline text-foreground/90">
                {savedPlan || <span className="text-muted-foreground">None saved</span>}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="inline text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Action{" "}
              </dt>
              <dd className="inline text-foreground/90">{item.neededAction}</dd>
            </div>
          </dl>

          {asText(item.details).trim() && asText(item.details) !== `Saved plan: ${savedPlan}` && (
            <p className="text-[13px] leading-snug text-muted-foreground">{item.details}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link
            to="/s/$sectionId"
            params={{ sectionId: item.sectionId }}
            search={{ row: item.rowId }}
            className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Full record
          </Link>
          {!detailed && (
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              aria-expanded={editOpen}
            >
              {editOpen ? "Hide edit" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {editOpen && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <ItemEditor item={item} />
        </div>
      )}
    </li>
  );
}

/**
 * Driver card: prominent name + issue count; collapsible.
 * Groups sorted upstream by urgency (worstTone).
 */
function DriverCard({
  driverId,
  driver,
  isNew,
  items,
  detailed,
  startGroupOpen,
}: {
  driverId: string;
  driver: string;
  isNew: boolean;
  items: WorkCenterItem[];
  detailed: boolean;
  /** Driver group accordion only — never auto-expands Future Plan suggestions. */
  startGroupOpen: boolean;
}) {
  const [open, setOpen] = useState(startGroupOpen);
  useEffect(() => {
    setOpen(startGroupOpen);
  }, [startGroupOpen, driverId]);

  const sections = useMemo(() => groupItemsBySection(items), [items]);

  return (
    <section className="compliance-today-driver border-b border-border/70 pb-4 last:border-b-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-baseline gap-2 text-left"
          aria-expanded={open}
        >
          <span className="text-muted-foreground" aria-hidden>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{driver}</h2>
          {isNew && (
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              New
            </span>
          )}
          <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {items.length} issue{items.length === 1 ? "" : "s"}
          </span>
        </button>
        <Link
          to="/drivers"
          search={{ driver: driverId }}
          className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Full driver record
        </Link>
      </header>

      {open && (
        <div className={cn("space-y-4 pl-1 sm:pl-6", detailed ? "space-y-5" : "space-y-3")}>
          {sections.map(({ section, items: sectionItems }) => (
            <div key={section} className="space-y-1">
              <h3 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {section}
              </h3>
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {sectionItems.map((item) => (
                  <DocIssueRow key={item.key} item={item} detailed={detailed} />
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
  const [detailMode, setDetailMode] = useState<"compact" | "detailed">(readDetailMode);

  const items = useMemo(() => collectWorkCenterItems(data), [data]);
  const filtered = useMemo(
    () => filterWorkCenterItems(items, filter, search),
    [items, filter, search],
  );
  const groups = useMemo(() => groupWorkCenterByDriver(filtered), [filtered]);
  const counts = useMemo(() => workCenterCounts(items), [items]);
  const detailed = detailMode === "detailed";

  const setMode = (next: "compact" | "detailed") => {
    setDetailMode(next);
    writeDetailMode(next);
  };

  return (
    <div className="compliance-today-page w-full min-w-0 max-w-none space-y-4 text-[15px] text-foreground">
      <header className="space-y-1 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
              My Compliance Today
            </h1>
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
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">{counts.drivers}</span> drivers ·{" "}
          <span className="font-medium text-foreground/80">{counts.all}</span> alerts · urgent /
          expired / expiring / pending first
        </p>
      </header>

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
            <div
              className="inline-flex h-9 items-center rounded-md border border-border bg-card p-0.5"
              role="group"
              aria-label="Compact or detailed view"
            >
              <button
                type="button"
                onClick={() => setMode("compact")}
                aria-pressed={detailMode === "compact"}
                className={cn(
                  "rounded px-2.5 text-sm font-semibold",
                  detailMode === "compact"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setMode("detailed")}
                aria-pressed={detailMode === "detailed"}
                className={cn(
                  "rounded px-2.5 text-sm font-semibold",
                  detailMode === "detailed"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Detailed
              </button>
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
              {groups.map((g, idx) => (
                <DriverCard
                  key={g.driverId}
                  driverId={g.driverId}
                  driver={g.driver}
                  isNew={g.isNew}
                  items={g.items}
                  detailed={detailed}
                  startGroupOpen={detailed || idx < 3}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
