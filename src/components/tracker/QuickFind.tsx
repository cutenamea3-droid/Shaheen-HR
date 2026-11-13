import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, FileText, IdCard, Search, UserRound } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  buildFinderDrivers,
  finderSearchValue,
  formatExpiringLabel,
  formatScopeShort,
  type FinderDriver,
} from "@/lib/quick-find";
import { useData } from "@/lib/store";

const STATUS_BADGE: Record<FinderDriver["employmentLabel"], string> = {
  Active: "bg-ok-soft text-ok",
  Leave: "bg-warn-soft text-warn",
  Inactive: "bg-muted text-muted-foreground",
  New: "bg-info/15 text-info",
};

type FinderAction = "card" | "info" | "alerts" | "docs";

/** Ctrl/Cmd+K Smart Driver Finder — jump by name, CDL, or driver ID (read-only). */
export function QuickFind() {
  const data = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  /** After picking a driver, show actions (Escape returns to results). */
  const [picked, setPicked] = useState<FinderDriver | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);

  const drivers = useMemo(() => buildFinderDrivers(data), [data]);

  function close() {
    setPicked(null);
    setOpen(false);
  }

  function go(action: FinderAction, d: FinderDriver) {
    close();
    if (action === "card") {
      void navigate({ to: "/drivers", search: { driver: d.driverId } });
      return;
    }
    if (action === "info" && d.infoRowId) {
      void navigate({ to: "/s/$sectionId", params: { sectionId: "info" }, search: { row: d.infoRowId } });
      return;
    }
    if (action === "docs" && d.docsRowId) {
      void navigate({ to: "/s/$sectionId", params: { sectionId: "docs" }, search: { row: d.docsRowId } });
      return;
    }
    if (action === "alerts") {
      const a = d.firstAlert;
      if (a?.target === "section") {
        void navigate({
          to: "/s/$sectionId",
          params: { sectionId: a.sectionId },
          search: { row: a.rowId },
        });
        return;
      }
      // Incomplete CDL / no section target → Driver Card (stable ID, no edit).
      void navigate({ to: "/drivers", search: { driver: d.driverId } });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Smart Driver Finder (Ctrl/Cmd+K)"
        className="ui-press inline-flex items-center gap-2 rounded-lg border-2 bg-card px-3 py-2 text-sm font-bold hover:border-primary hover:text-primary"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Quick Find</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        commandKey={picked ? `actions-${picked.driverId}` : "results"}
        onOpenChange={(v) => {
          if (!v && picked) {
            setPicked(null);
            return;
          }
          setOpen(v);
        }}
        contentClassName="border-ink/20 bg-card"
      >
        <div className="border-b bg-[linear-gradient(100deg,#18202a_0%,#202A36_55%,#2a3544_100%)] px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-extrabold tracking-tight sm:text-lg">
              Smart Driver Finder
            </h2>
            <span className="hidden text-[11px] font-semibold text-primary-foreground/70 sm:inline">
              Esc · ↑↓ · Enter
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-primary-foreground/80">
            {picked
              ? `Choose where to open ${picked.name || "this driver"} — selection never edits records.`
              : "Search by name, CDL, or driver ID. Enter opens the Driver Card; then pick Info, Alerts, or Docs."}
          </p>
        </div>

        {!picked ? (
          <>
            <CommandInput placeholder="Search drivers by name, CDL, or ID…" autoFocus />
            <CommandList className="max-h-[min(58vh,480px)]">
              <CommandEmpty>No drivers found.</CommandEmpty>
              <CommandGroup heading="Drivers">
                {drivers.map((d) => (
                  <CommandItem
                    key={d.driverId}
                    value={finderSearchValue(d)}
                    onSelect={() => setPicked(d)}
                    className="items-start gap-3 py-2.5 aria-selected:bg-secondary data-[selected=true]:bg-secondary"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-extrabold text-primary-foreground">
                      {d.name.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-foreground">{d.name || "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        CDL {d.cdl || "—"}
                        <span className="mx-1.5 text-border">·</span>
                        <span className="font-mono text-[11px]">{d.driverId}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        <MetaChip tone={d.issues ? "danger" : "muted"}>
                          {d.issues ? `${d.issues} issue${d.issues === 1 ? "" : "s"}` : "0 issues"}
                        </MetaChip>
                        <MetaChip tone={d.expiring ? "warn" : "muted"}>{formatExpiringLabel(d)}</MetaChip>
                        <MetaChip tone={d.missingDocs ? "danger" : "muted"}>
                          {d.missingDocs ? `${d.missingDocs} missing docs` : "0 missing docs"}
                        </MetaChip>
                        <MetaChip tone={d.tempNotes ? "note" : "muted"}>
                          {d.tempNotes ? `${d.tempNotes} temp note${d.tempNotes === 1 ? "" : "s"}` : "0 temp notes"}
                        </MetaChip>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-bold",
                          STATUS_BADGE[d.employmentLabel],
                        )}
                      >
                        {d.employmentLabel}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                        {formatScopeShort(d.scope)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-base font-extrabold text-primary-foreground">
                {picked.name.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold">{picked.name || "—"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  CDL {picked.cdl || "—"} · {picked.employmentLabel} · {formatScopeShort(picked.scope)}
                </div>
              </div>
              <button
                type="button"
                className="ui-press rounded-md border px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => setPicked(null)}
              >
                Back
              </button>
            </div>
            <CommandInput placeholder="Filter actions…" autoFocus />
            <CommandList>
              <CommandEmpty>No matching actions.</CommandEmpty>
              <CommandGroup heading="Open">
                <p className="px-2 pb-1 text-[12px] leading-snug text-muted-foreground">
                  Navigates by stable driver ID. Does not edit compliance data.
                </p>
                <ActionItem
                  value="open driver card"
                  icon={IdCard}
                  title="Open Driver Card"
                  hint="All documents for this driver on one card"
                  onSelect={() => go("card", picked)}
                />
                {picked.infoRowId && (
                  <ActionItem
                    value="driver information contact"
                    icon={UserRound}
                    title="Driver Information"
                    hint="Phone, email, and contact fields"
                    onSelect={() => go("info", picked)}
                  />
                )}
                <ActionItem
                  value="view alerts smart"
                  icon={AlertTriangle}
                  title="View Alerts"
                  hint={
                    picked.firstAlert
                      ? `Jump to ${picked.firstAlert.document} (${picked.firstAlert.group})`
                      : "No active alerts — opens Driver Card"
                  }
                  onSelect={() => go("alerts", picked)}
                />
                {picked.docsRowId && (
                  <ActionItem
                    value="view relevant docs other documents"
                    icon={FileText}
                    title="View relevant docs"
                    hint={
                      picked.missingDocs
                        ? `${picked.missingDocs} missing/invalid on Other Docs`
                        : "Other Documents checklist for this driver"
                    }
                    onSelect={() => go("docs", picked)}
                  />
                )}
              </CommandGroup>
            </CommandList>
          </>
        )}
      </CommandDialog>
    </>
  );
}

function MetaChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "danger" | "warn" | "note" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "note" && "bg-note-soft text-note",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function ActionItem({
  value,
  icon: Icon,
  title,
  hint,
  onSelect,
}: {
  value: string;
  icon: typeof IdCard;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      className="items-start gap-3 py-3 data-[selected=true]:bg-secondary"
    >
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-ink-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </CommandItem>
  );
}
