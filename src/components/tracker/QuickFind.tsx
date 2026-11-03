import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SECTIONS, formatDriverStatus, type DriverStatus } from "@/lib/sections";
import { analyzeRow, driverExpiryDays, rowAlertsMuted, rowDriverStatus } from "@/lib/alerts";
import { useData } from "@/lib/store";

interface QuickDriver {
  driverId: string;
  name: string;
  cdl: string;
  status: DriverStatus;
  expiring: number;
  issues: number;
}

const STATUS_BADGE: Record<DriverStatus, string> = {
  active: "bg-ok-soft text-ok",
  leave: "bg-warn-soft text-warn",
  inactive: "bg-muted text-muted-foreground",
};

/** Ctrl/Cmd+K command palette — jump to a driver card by name or CDL. */
export function QuickFind() {
  const data = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) && !open) {
        // Still allow Cmd+K from fields — this is the global quick-find shortcut.
      }
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const drivers = useMemo(() => {
    const map = new Map<string, QuickDriver>();
    for (const def of SECTIONS) {
      if (def.id === "inactive") continue;
      const sec = data.sections[def.id];
      for (const r of sec.rows) {
        let d = map.get(r.driverId);
        if (!d) {
          d = {
            driverId: r.driverId,
            name: (r.cells[0] ?? "").trim(),
            cdl: "",
            status: rowDriverStatus(def, r, data),
            expiring: 0,
            issues: 0,
          };
          map.set(r.driverId, d);
        }
        d.status = rowDriverStatus(def, r, data);
        if (!d.name) d.name = (r.cells[0] ?? "").trim();
        if (!rowAlertsMuted(def, r, data)) d.issues += analyzeRow(def, sec.headers, r).issues.length;
        if (def.id === "ssccdl" && (r.cells[1] ?? "").trim()) d.cdl = (r.cells[1] ?? "").trim();
        if (def.id === "dmv" && !d.cdl) d.cdl = (r.cells[1] ?? "").trim();
      }
    }
    return [...map.values()]
      .map((d) => ({
        ...d,
        expiring: driverExpiryDays(data, d.driverId).filter((n) => n <= 30).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [data]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Quick Find (Ctrl/Cmd+K)"
        className="ui-press inline-flex items-center gap-2 rounded-lg border-2 bg-card px-3 py-2 text-sm font-bold hover:border-primary hover:text-primary"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Quick Find</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search drivers by name or CDL…" />
        <CommandList>
          <CommandEmpty>No drivers found.</CommandEmpty>
          <CommandGroup heading="Drivers">
            {drivers.map((d) => (
              <CommandItem
                key={d.driverId}
                value={`${d.name} ${d.cdl} ${d.driverId}`}
                onSelect={() => {
                  setOpen(false);
                  void navigate({ to: "/drivers", search: { driver: d.driverId } });
                }}
                className="items-start gap-3 py-2.5"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-extrabold text-primary-foreground">
                  {d.name.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{d.name || "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">CDL {d.cdl || "—"}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_BADGE[d.status])}>
                    {formatDriverStatus(d.status)}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      d.expiring ? "text-warn" : "text-muted-foreground",
                    )}
                  >
                    {d.expiring ? `${d.expiring} expiring` : "None expiring"}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
