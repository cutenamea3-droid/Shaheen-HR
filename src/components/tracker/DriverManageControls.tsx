import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  classHistoryOf,
  driverClassOf,
  formatDriverClass,
  isNewDriver,
  rosterKindOf,
  type DriverClass,
} from "@/lib/driver-meta";
import { setDriverClass, setDriverRosterKind, useData } from "@/lib/store";
import { useViewMode } from "@/lib/viewmode";

/**
 * Company ↔ Owner Operator + Move to Active Drivers controls.
 * Confirm before every change. History kept on the same driver rows (no delete/recreate).
 */
export function DriverManageControls({ driverId, name }: { driverId: string; name: string }) {
  const data = useData();
  const view = useViewMode();
  const klass = driverClassOf(data, driverId);
  const isNew = isNewDriver(data, driverId);
  const history = classHistoryOf(data, driverId);
  const label = name.trim() || "this driver";

  if (view) {
    return (
      <div className="mt-3 space-y-2 rounded-xl bg-primary-foreground/10 p-3">
        <div className="text-xs font-extrabold tracking-widest uppercase opacity-90">Management</div>
        <div className="text-sm font-bold">
          {isNew ? "New Driver (onboarding)" : formatDriverClass(klass)}
        </div>
        <p className="text-xs opacity-80">Management class is not a legal exemption.</p>
      </div>
    );
  }

  function confirmClass(next: DriverClass) {
    if (next === klass) return;
    const msg =
      next === "owner_operator"
        ? `Mark ${label} as Owner Operator?\n\nThey leave company lists and reminders but keep all documents and history. This is a management class — not a legal exemption. Not the same as Inactive.`
        : `Move ${label} back to Company Driver?\n\nThey return to company lists. Full history is kept — no duplicate or recreate.`;
    if (!confirm(msg)) return;
    setDriverClass(driverId, next);
    toast.success(next === "owner_operator" ? "Marked Owner Operator" : "Restored as Company Driver");
  }

  function moveToActive() {
    if (
      !confirm(
        `Move ${label} to Active Drivers?\n\nThey leave the New Drivers list and join the company roster (employment stays as set). You can reverse this later.`,
      )
    )
      return;
    setDriverRosterKind(driverId, "roster");
    toast.success("Moved to Active Drivers");
  }

  function reverseToNew() {
    if (
      !confirm(
        `Return ${label} to New Drivers (onboarding)?\n\nThey leave company / Owner Operator lists until moved to Active again.`,
      )
    )
      return;
    setDriverRosterKind(driverId, "new");
    toast.success("Returned to New Drivers");
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-primary-foreground/10 p-3">
      <div className="text-xs font-extrabold tracking-widest uppercase opacity-90">Management</div>
      <p className="text-xs leading-snug opacity-85">
        New = onboarding · Company / Owner Op = class · Active / Leave / Inactive = employment. Class ≠ legal
        exemption.
      </p>

      {isNew ? (
        <div className="space-y-2">
          <div className="inline-flex rounded-lg bg-info/20 px-2.5 py-1 text-sm font-bold">New Driver</div>
          <button
            type="button"
            onClick={moveToActive}
            className="flex h-9 w-full items-center justify-center rounded-lg border-2 border-primary-foreground/40 bg-primary-foreground/15 px-3 text-sm font-bold hover:bg-primary-foreground/25"
          >
            Move to Active Drivers
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Driver classification">
            {(["company", "owner_operator"] as DriverClass[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => confirmClass(c)}
                aria-pressed={klass === c}
                className={cn(
                  "rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition",
                  klass === c
                    ? "border-primary-foreground bg-primary-foreground text-brand"
                    : "border-primary-foreground/35 bg-transparent hover:bg-primary-foreground/15",
                )}
              >
                {formatDriverClass(c)}
              </button>
            ))}
          </div>
          {rosterKindOf(data, driverId) === "roster" && (
            <button
              type="button"
              onClick={reverseToNew}
              className="text-xs font-semibold underline-offset-2 opacity-80 hover:underline"
            >
              Return to New Drivers
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <details className="text-xs opacity-85">
          <summary className="cursor-pointer font-bold">Classification history ({history.length})</summary>
          <ul className="mt-1.5 space-y-1 pl-1">
            {[...history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                {formatDriverClass(h.from)} → {formatDriverClass(h.to)} ·{" "}
                {new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
