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
 * UI: neutral panel on brand header — solid selected/unselected (never text-brand clip).
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
      <div className="tracker-manage-panel space-y-2">
        <div className="tracker-manage-title">Management</div>
        <div className="text-sm font-bold text-foreground">
          {isNew ? "New Driver (onboarding)" : formatDriverClass(klass)}
        </div>
        <p className="tracker-manage-hint mt-0">Management class is not a legal exemption.</p>
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
    <div className="tracker-manage-panel space-y-3">
      <div>
        <div className="tracker-manage-title">Management</div>
        <p className="tracker-manage-hint">
          New = onboarding · Company / Owner Op = class · Active / Leave / Inactive = employment. Class ≠ legal
          exemption.
        </p>
      </div>

      {isNew ? (
        <div className="space-y-2">
          <div className="inline-flex rounded-lg border-2 border-info/30 bg-info-soft px-2.5 py-1.5 text-sm font-bold text-info">
            New Driver
          </div>
          <button type="button" onClick={moveToActive} className="tracker-manage-action">
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
                className={cn("tracker-manage-btn", klass === c && "tracker-manage-btn-on")}
              >
                {formatDriverClass(c)}
              </button>
            ))}
          </div>
          {rosterKindOf(data, driverId) === "roster" && (
            <button type="button" onClick={reverseToNew} className="tracker-manage-action">
              Return to New Drivers
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer font-bold text-foreground">Classification history ({history.length})</summary>
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
