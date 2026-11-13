/**
 * Batch 8 surfaces: BOL/POD docs, follow-ups, driver/equipment board.
 * Additive — does not rewrite My Dispatch Today / Active Loads / Driver Updates / Handover cores.
 */
import { useEffect, useState } from "react";
import { listFollowUps, saveFollowUp, saveLoad } from "@/dispatch/lib/cloud";
import {
  awaitingBolLoads,
  awaitingPodLoads,
  buildEquipmentBoard,
  dueFollowUps,
  openFollowUps,
} from "@/dispatch/lib/ops-controls";
import { statusLabel } from "@/dispatch/lib/status";
import type { DispatchFollowUp, DispatchLoad, DocStatus, RosterDriver } from "@/dispatch/lib/types";
import { EmptyHint, SectionHelp } from "./EmptyHint";

const DOC_STATUSES: DocStatus[] = ["missing", "pending", "received", "verified", "exception"];

export function DocsBoard({
  loads,
  onOpen,
  onRefresh,
}: {
  loads: DispatchLoad[];
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const bol = awaitingBolLoads(loads);
  const pod = awaitingPodLoads(loads);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchDoc(
    load: DispatchLoad,
    field: "bol_status" | "pod_status",
    value: DocStatus,
  ) {
    setBusyId(load.id);
    setError(null);
    try {
      await saveLoad({
        id: load.id,
        load_number: load.load_number,
        status: load.status,
        bol_status: field === "bol_status" ? value : load.bol_status,
        pod_status: field === "pod_status" ? value : load.pod_status,
        assigned_driver_id: load.assigned_driver_id,
        assigned_driver_name: load.assigned_driver_name,
        customer_name: load.customer_name,
        commodity: load.commodity,
        equipment: load.equipment,
        notes: load.notes,
        exception_open: load.exception_open,
        cancel_reason: load.cancel_reason,
        reschedule_note: load.reschedule_note,
        closeout_note: load.closeout_note,
        closed_at: load.closed_at,
        reopen_reason: load.reopen_reason,
        reopened_at: load.reopened_at,
        payment_status: load.payment_status,
        planned_pickup_at: load.planned_pickup_at,
        planned_delivery_at: load.planned_delivery_at,
        actual_pickup_at: load.actual_pickup_at,
        actual_delivery_at: load.actual_delivery_at,
        last_manual_location: load.last_manual_location,
        last_manual_location_at: load.last_manual_location_at,
        stale_after_minutes: load.stale_after_minutes,
        ...(load.stops ? { stops: load.stops } : {}),
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update doc status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-3">
      <SectionHelp>
        BOL and POD statuses are independent desk records. This board never invents document files,
        scans, or ETAs — update status only when the desk has the paperwork.
      </SectionHelp>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <DocList
        title="Awaiting BOL"
        items={bol}
        field="bol_status"
        busyId={busyId}
        onPatch={patchDoc}
        onOpen={onOpen}
      />
      <DocList
        title="Awaiting POD"
        items={pod}
        field="pod_status"
        busyId={busyId}
        onPatch={patchDoc}
        onOpen={onOpen}
      />
    </div>
  );
}

function DocList({
  title,
  items,
  field,
  busyId,
  onPatch,
  onOpen,
}: {
  title: string;
  items: DispatchLoad[];
  field: "bol_status" | "pod_status";
  busyId: string | null;
  onPatch: (load: DispatchLoad, field: "bol_status" | "pod_status", value: DocStatus) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="dispatch-panel">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">{title}</h2>
        <span className="text-xs text-[color:var(--dispatch-muted)]">{items.length}</span>
      </div>
      {!items.length ? (
        <EmptyHint>Nothing awaiting.</EmptyHint>
      ) : (
        <ul className="divide-y divide-[color:var(--dispatch-border)]">
          {items.map((load) => (
            <li key={load.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm font-semibold">
                  {load.load_number}{" "}
                  <span className="font-normal text-[color:var(--dispatch-muted)]">
                    · {statusLabel(load.status)}
                  </span>
                </p>
                <p className="text-xs text-[color:var(--dispatch-muted)]">
                  BOL {load.bol_status} · POD {load.pod_status}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="dispatch-field w-auto text-xs"
                  value={load[field]}
                  disabled={busyId === load.id}
                  onChange={(e) => void onPatch(load, field, e.target.value as DocStatus)}
                >
                  {DOC_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="button" className="dispatch-btn-primary" onClick={() => onOpen(load.id)}>
                  Update Load
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FollowUpsBoard({
  loads,
  onOpenLoad,
}: {
  loads: DispatchLoad[];
  onOpenLoad: (id: string) => void;
}) {
  const [rows, setRows] = useState<DispatchFollowUp[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loadId, setLoadId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setRows(await listFollowUps());
  }

  useEffect(() => {
    void reload();
  }, []);

  const due = dueFollowUps(rows);
  const open = openFollowUps(rows);

  return (
    <section className="dispatch-panel grid gap-3">
      <SectionHelp>
        Follow-up reminders are a desk list only — they do not send push, SMS, or email notifications.
        Mark done when the desk completes the call or task.
      </SectionHelp>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="dispatch-field"
          placeholder="Reminder title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="dispatch-field"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <select className="dispatch-field" value={loadId} onChange={(e) => setLoadId(e.target.value)}>
          <option value="">No load link</option>
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.load_number}
            </option>
          ))}
        </select>
        <input
          className="dispatch-field"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="dispatch-btn-primary w-fit"
        onClick={async () => {
          if (!title.trim() || !dueAt) {
            setError("Title and due time are required.");
            return;
          }
          setError(null);
          await saveFollowUp({
            title: title.trim(),
            notes: notes.trim() || null,
            due_at: new Date(dueAt).toISOString(),
            load_id: loadId || null,
          });
          setTitle("");
          setNotes("");
          setDueAt("");
          setLoadId("");
          await reload();
        }}
      >
        Add follow-up
      </button>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-[color:var(--dispatch-navy)]">
          Due now ({due.length})
        </h3>
        {!due.length ? (
          <EmptyHint>No follow-ups due.</EmptyHint>
        ) : (
          <FollowUpList rows={due} loads={loads} onOpenLoad={onOpenLoad} onChanged={reload} />
        )}
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-[color:var(--dispatch-navy)]">
          Open ({open.length})
        </h3>
        {!open.length ? (
          <EmptyHint>No open follow-ups.</EmptyHint>
        ) : (
          <FollowUpList rows={open} loads={loads} onOpenLoad={onOpenLoad} onChanged={reload} />
        )}
      </div>
    </section>
  );
}

function FollowUpList({
  rows,
  loads,
  onOpenLoad,
  onChanged,
}: {
  rows: DispatchFollowUp[];
  loads: DispatchLoad[];
  onOpenLoad: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <ul className="divide-y divide-[color:var(--dispatch-border)]">
      {rows.map((row) => {
        const load = loads.find((l) => l.id === row.load_id);
        return (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-semibold">{row.title}</p>
              <p className="text-xs text-[color:var(--dispatch-muted)]">
                Due {new Date(row.due_at).toLocaleString()}
                {load ? ` · ${load.load_number}` : ""}
                {row.notes ? ` · ${row.notes}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.load_id && (
                <button type="button" className="dispatch-btn-ghost" onClick={() => onOpenLoad(row.load_id!)}>
                  Open load
                </button>
              )}
              {row.status === "open" && (
                <button
                  type="button"
                  className="dispatch-btn-primary"
                  onClick={async () => {
                    await saveFollowUp({ ...row, status: "done" });
                    await onChanged();
                  }}
                >
                  Mark done
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EquipmentBoard({
  drivers,
  loads,
  onOpen,
}: {
  drivers: RosterDriver[];
  loads: DispatchLoad[];
  onOpen: (id: string) => void;
}) {
  const rows = buildEquipmentBoard(drivers, loads);
  return (
    <section className="dispatch-panel">
      <SectionHelp>
        Driver / Equipment Board shows roster unit numbers and equipment labels recorded on assigned
        loads. It does <strong>not</strong> invent HOS, free/busy, or availability.
      </SectionHelp>
      {!rows.length ? (
        <EmptyHint>No roster drivers.</EmptyHint>
      ) : (
        <div className="overflow-x-auto">
          <table className="dispatch-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Unit</th>
                <th>Equipment on loads</th>
                <th>Active / delivered loads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.driver.id}>
                  <td className="font-semibold">{row.driver.display_name}</td>
                  <td>{row.unit_number || "—"}</td>
                  <td className="text-xs">
                    {row.equipmentLabels.length ? row.equipmentLabels.join(", ") : "— (none recorded)"}
                  </td>
                  <td>
                    {!row.activeLoads.length ? (
                      <span className="text-xs text-[color:var(--dispatch-muted)]">No active loads</span>
                    ) : (
                      <ul className="space-y-1">
                        {row.activeLoads.map((l) => (
                          <li key={l.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <span>
                              {l.load_number} · {statusLabel(l.status)}
                              {l.equipment ? ` · ${l.equipment}` : ""}
                            </span>
                            <button type="button" className="dispatch-btn-ghost" onClick={() => onOpen(l.id)}>
                              Update
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
