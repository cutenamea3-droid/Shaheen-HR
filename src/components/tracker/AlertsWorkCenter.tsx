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
import { SECTIONS } from "@/lib/sections";
import { suggestPlanForCell } from "@/lib/plan-dates";
import { DateCell, EditableText, StatusToggle, Chip } from "./cells";
import { FuturePlanSuggest } from "./FuturePlanSuggest";
import { DriverManageControls } from "./DriverManageControls";
import type { Tone } from "@/lib/alerts";

const TONE_BORDER: Record<Tone, string> = {
  danger: "border-danger/50",
  warn: "border-warn/50",
  info: "border-info/40",
  note: "border-gold/50",
  ok: "border-ok/40",
  sign: "border-sign/50",
  muted: "border-border",
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
  const row = data.sections[item.sectionId]?.rows.find((r) => r.id === item.rowId);
  if (!row) {
    return <p className="text-sm font-semibold text-danger">Row missing — refresh or open full record.</p>;
  }

  const def = SECTIONS.find((s) => s.id === item.sectionId);
  const statusOpts = sectionStatusOptions(item.sectionId);
  // Live recompute so expiry edits instantly refresh reminder (never double-subtract lead).
  const liveSuggestion =
    item.planCol != null ? suggestPlanForCell(item.sectionId, item.planCol, row) : item.planSuggestion;

  if (item.linkOnly && item.kind !== "new_driver") {
    return (
      <p className="text-sm font-semibold text-muted-foreground">
        {item.linkOnly.reason}.{" "}
        {item.linkOnly.to === "/drivers" ? (
          <Link to="/drivers" search={{ driver: item.driverId }} className="font-bold text-primary underline">
            {item.linkOnly.label}
          </Link>
        ) : (
          <Link
            to="/s/$sectionId"
            params={{ sectionId: item.sectionId }}
            search={{ row: item.rowId }}
            className="font-bold text-primary underline"
          >
            {item.linkOnly.label}
          </Link>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {item.kind === "new_driver" && (
        <div className="rounded-lg border bg-card p-3">
          <DriverManageControls driverId={item.driverId} name={item.driver} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {item.statusCol != null && statusOpts.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">Status</div>
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
            <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Expiry / due
            </div>
            <DateCell
              value={row.cells[item.dateCol] ?? ""}
              onSave={(v) =>
                safeSave(item.sectionId, item.rowId, item.dateCol!, v, row.cells[item.dateCol!] ?? "", "Expiry date")
              }
              appliedStatus={item.statusCol != null ? row.cells[item.statusCol] : undefined}
            />
            <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
              Changing expiry recalculates the Future Plan suggestion instantly (saved plan unchanged).
            </p>
          </div>
        )}
      </div>

      {item.planCol != null && (
        <div>
          <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
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
          <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
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
        <p className="text-sm font-semibold text-info">
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
    <article className={cn("rounded-xl border-2 bg-card shadow-card", TONE_BORDER[worst])}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
        aria-expanded={open}
      >
        <span className="mt-1 text-muted-foreground">
          {open ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-extrabold text-foreground">{driver}</h2>
            {isNew && (
              <span className="rounded-md bg-info/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-info uppercase">
                New
              </span>
            )}
            <span className="text-sm font-bold text-muted-foreground">
              {items.length} issue{items.length === 1 ? "" : "s"}
            </span>
          </div>
          {!open && (
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {items.slice(0, 3).map((i) => (
                <li key={i.key} className="truncate">
                  <span className="font-semibold text-foreground">{i.docType}</span>
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
          className="shrink-0 rounded-lg border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-primary hover:border-primary"
        >
          Open Full Driver Record
        </Link>
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3">
          {items.map((item) => (
            <div key={item.key} className={cn("rounded-lg border bg-background/80 p-3", TONE_BORDER[item.tone])}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={item.tone}>{item.docType}</Chip>
                    <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {item.sectionTitle}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] font-semibold text-foreground">{item.details}</p>
                  <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <span className="font-bold">Status: </span>
                      {item.statusLabel}
                      {item.dmvApplied ? " (DMV Applied)" : ""}
                    </div>
                    <div>
                      <span className="font-bold">Expiry / due: </span>
                      {item.expiryDisplay}
                    </div>
                    <div>
                      <span className="font-bold">Days: </span>
                      {item.daysLabel}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="font-bold">Needed action: </span>
                      {item.neededAction}
                    </div>
                    {item.planSuggestion?.leadDays != null && item.kind === "plan" && (
                      <div className="sm:col-span-2 text-muted-foreground">
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
                  className="text-sm font-bold text-primary underline"
                >
                  View in section
                </Link>
              </div>
              <div className="mt-3 border-t pt-3">
                <div className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
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
  const [filter, setFilter] = useState<WorkCenterFilter>("all");
  const [search, setSearch] = useState("");

  const items = useMemo(() => collectWorkCenterItems(data), [data]);
  const filtered = useMemo(() => filterWorkCenterItems(items, filter, search), [items, filter, search]);
  const groups = useMemo(() => groupWorkCenterByDriver(filtered), [filtered]);
  const counts = useMemo(() => workCenterCounts(items), [items]);

  return (
    <div className="w-full min-w-0 max-w-none space-y-4 text-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="ui-press inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:border-primary hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <p className="text-sm font-semibold text-muted-foreground">
          {counts.drivers} drivers · {counts.all} alerts — edit and save on this page
        </p>
      </div>

      {/* Summary counters */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Alert summary">
        {WORK_CENTER_FILTERS.map((f) => {
          const n = counts[f.id];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "ui-press rounded-lg border-2 px-3 py-1.5 text-sm font-bold tabular-nums",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/60",
              )}
            >
              {f.label}
              <span className={cn("ml-2 opacity-90", active ? "" : "text-primary")}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search driver or document type…"
          className="w-full rounded-lg border-2 border-border bg-card py-2 pr-3 pl-10 text-[15px] font-semibold outline-none focus:border-primary"
          aria-label="Search alerts"
        />
      </div>

      {!groups.length ? (
        <div className="rounded-xl border-2 border-ok/40 bg-ok-soft px-5 py-8 text-center">
          <p className="font-display text-xl font-extrabold text-ok">All clear for this filter</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            No drivers need attention here. Try All or clear search.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
    </div>
  );
}
