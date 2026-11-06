import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtCell, parseISO } from "@/lib/alerts";
import {
  dateOfHireOf,
  formatHireDateDisplay,
  lengthOfService,
  parseHireDateInput,
} from "@/lib/driver-hr/hire-date";
import { setDriverDateOfHire, useData } from "@/lib/store";
import { useViewMode } from "@/lib/viewmode";

/** Optional Date of Hire — picker + MM/DD/YYYY manual, clearable, independent save. */
export function HireDateField({ driverId }: { driverId: string }) {
  const data = useData();
  const view = useViewMode();
  const value = dateOfHireOf(data, driverId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const los = lengthOfService(value);

  const commit = (raw: string) => {
    const parsed = parseHireDateInput(raw);
    if (parsed === null) {
      toast.error("Use MM/DD/YYYY or pick a date");
      return;
    }
    if (parsed !== value) setDriverDateOfHire(driverId, parsed);
    setEditing(false);
  };

  const clear = () => {
    if (value) setDriverDateOfHire(driverId, "");
    setDraft("");
    setEditing(false);
  };

  if (editing && !view) {
    return (
      <div className="tracker-profile-section space-y-2 p-4">
        <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Date of Hire</div>
        <input
          type="date"
          value={parseISO(draft) ? draft : ""}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border-2 border-primary bg-card px-2.5 py-1.5 text-base"
          aria-label="Date of hire picker"
        />
        <input
          value={draft.includes("-") && parseISO(draft) ? formatHireDateDisplay(draft) : draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="MM/DD/YYYY"
          className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-sm"
          aria-label="Date of hire typed"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => commit(draft)}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-primary-foreground"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="rounded-lg border px-3 py-1.5 text-sm font-bold"
          >
            Cancel
          </button>
          {value && (
            <button type="button" onClick={clear} className="rounded-lg px-3 py-1.5 text-sm font-bold text-muted-foreground hover:text-danger">
              Clear
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-profile-section p-4">
      <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">Date of Hire</div>
      <button
        type="button"
        disabled={view}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-base font-semibold",
          value ? "bg-card hover:border-primary/60" : "border-dashed font-normal italic text-muted-foreground/70",
        )}
      >
        <span className="inline-flex items-center gap-2">
          {value && parseISO(value) && <CalendarDays className="size-4 shrink-0 opacity-70" />}
          {value ? formatHireDateDisplay(value) || fmtCell(value) : "Add date of hire"}
        </span>
        {value && !view && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date of hire"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
          >
            <X className="size-4" />
          </span>
        )}
      </button>
      {los && (
        <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
          Length of service: {los.label}
        </p>
      )}
    </div>
  );
}
