import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOptionalPortalAccount } from "@/components/tracker/LockGate";
import { useViewMode } from "@/lib/viewmode";
import {
  addDrugTestEvent,
  deleteDrugTestEvent,
  listDrugTestsAsync,
  restoreDrugTestEvent,
  subscribeDrugTestMock,
  updateDrugTestEvent,
} from "@/lib/driver-hr/drug-test-api";
import {
  canPersistDrugTests,
  driverDrugTestModeLabel,
  drugTestPersistBlockedReason,
  getDriverDrugTestMode,
} from "@/lib/driver-hr/drug-test-mode";
import {
  DRUG_PAIR_STATUS_LABEL,
  filterDrugPairs,
  formatDrugDocKind,
  pairDrugTestEvents,
  type DrugPairStatus,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";
import { DrugTestEventEditor, DRUG_STATUS_TONE } from "./DrugTestForm";

/**
 * Drug Test Records — admin-authorized register (not PDF upload).
 * Same secure RPCs as the sidebar Drug Test Records page.
 * Pairing verifies paperwork only — Matched ≠ Negative / clearance / approval.
 */
export function DrugTestRegister({ driverId, driverName }: { driverId: string; driverName: string }) {
  const role = useOptionalPortalAccount()?.account.role;
  const actor = useOptionalPortalAccount()?.account.email ?? "portal";
  const view = useViewMode();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DrugPairStatus | "all">("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [events, setEvents] = useState<DrugTestEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mode = getDriverDrugTestMode();
  const persistOk = canPersistDrugTests();
  const blocked = drugTestPersistBlockedReason(mode);
  void driverName;

  useEffect(() => {
    let alive = true;
    const reload = () => {
      if (!persistOk) {
        if (alive) {
          setEvents([]);
          setLoadError(blocked);
        }
        return;
      }
      void listDrugTestsAsync(driverId, actor).then((res) => {
        if (!alive) return;
        setEvents(res.events);
        setLoadError(res.error);
      });
    };
    reload();
    const unsub = subscribeDrugTestMock(reload);
    return () => {
      alive = false;
      unsub();
    };
  }, [driverId, actor, persistOk, blocked]);

  const pairs = useMemo(() => pairDrugTestEvents(events), [events]);
  const filtered = useMemo(
    () => filterDrugPairs(pairs, { status: statusFilter, q }),
    [pairs, statusFilter, q],
  );

  if (!isAdmin) {
    return (
      <section className="tracker-profile-section">
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-bold text-foreground">Drug Test Records</span> — authorized accounts only
            (not stored in shared driver JSON).
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="tracker-profile-section">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h3 className="tracker-profile-section-h !mb-0 !border-0">Drug Test Records</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Federal Drug (CCF) · Medical Review (MRO) · {driverDrugTestModeLabel(mode)}
            {events.length ? ` · ${events.length} event${events.length === 1 ? "" : "s"}` : " · none yet"}
          </p>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-foreground/10 px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Records only (no PDF). FD/MR link by testing event id (then specimen + reason + collection).
            Matched means documents line up — not Negative, clearance, or approval. Other Documents /
            medical / duty stay untouched. Incomplete entries stay editable. Remove is soft-delete
            (recoverable) — history is not permanently erased. Same records as the Drug Test Records
            sidebar page.
          </p>

          {(blocked || loadError) && (
            <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
              {blocked ?? loadError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter specimen, reason, context…"
              className="min-w-[10rem] flex-1 rounded-lg border bg-card px-2.5 py-1.5 text-sm"
              aria-label="Filter drug test records"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DrugPairStatus | "all")}
              className="rounded-lg border bg-card px-2.5 py-1.5 text-sm font-semibold"
              aria-label="Status filter"
            >
              <option value="all">All statuses</option>
              {(Object.keys(DRUG_PAIR_STATUS_LABEL) as DrugPairStatus[]).map((s) => (
                <option key={s} value={s}>
                  {DRUG_PAIR_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {!view && (
              <button
                type="button"
                disabled={!persistOk}
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-bold hover:border-primary disabled:opacity-50"
              >
                <Plus className="size-4" /> Add event
              </button>
            )}
          </div>

          {adding && !view && (
            <DrugTestEventEditor
              disabled={!persistOk}
              linkOptions={events
                .filter((e) => e.kind === "federal_drug" && e.testingEventId)
                .map((e) => ({
                  id: e.testingEventId,
                  label: `Link FD ${e.specimenId || "incomplete"} · ${e.reason || "—"}`,
                }))}
              onCancel={() => setAdding(false)}
              onSave={async (draft) => {
                try {
                  await addDrugTestEvent({ ...draft, driverId }, actor);
                  setAdding(false);
                  toast.success("Event saved");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Save failed");
                }
              }}
            />
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs font-extrabold tracking-wider uppercase">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Federal Drug</th>
                  <th className="px-3 py-2">Medical Review</th>
                  <th className="px-3 py-2">Specimen</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Collection</th>
                  {!view && <th className="px-3 py-2"> </th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10 align-top">
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-bold", DRUG_STATUS_TONE[row.status])}>
                        {DRUG_PAIR_STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.federal ? (
                        <EventMini ev={row.federal} actor={actor} view={view} persistOk={persistOk} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.medical ? (
                        <EventMini ev={row.medical} actor={actor} view={view} persistOk={persistOk} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{row.specimenId || "—"}</td>
                    <td className="px-3 py-2">{row.reason || "—"}</td>
                    <td className="px-3 py-2 text-xs">{row.collectionContext || "—"}</td>
                    {!view && (
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {row.federal && (
                            <button
                              type="button"
                              aria-label="Soft-delete Federal Drug event"
                              title="Soft-delete (recoverable)"
                              disabled={!persistOk}
                              onClick={async () => {
                                if (confirm("Soft-delete this Federal Drug event? History stays recoverable.")) {
                                  try {
                                    await deleteDrugTestEvent(row.federal!.id, actor);
                                    toast.success("Soft-deleted", {
                                      action: {
                                        label: "Restore",
                                        onClick: () => {
                                          void restoreDrugTestEvent(row.federal!.id, actor).then(
                                            () => toast.success("Restored"),
                                            (e) => toast.error(e instanceof Error ? e.message : "Restore failed"),
                                          );
                                        },
                                      },
                                    });
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Delete failed");
                                  }
                                }
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                          {row.medical && (
                            <button
                              type="button"
                              aria-label="Soft-delete Medical Review event"
                              title="Soft-delete (recoverable)"
                              disabled={!persistOk}
                              onClick={async () => {
                                if (confirm("Soft-delete this Medical Review event? History stays recoverable.")) {
                                  try {
                                    await deleteDrugTestEvent(row.medical!.id, actor);
                                    toast.success("Soft-deleted", {
                                      action: {
                                        label: "Restore",
                                        onClick: () => {
                                          void restoreDrugTestEvent(row.medical!.id, actor).then(
                                            () => toast.success("Restored"),
                                            (e) => toast.error(e instanceof Error ? e.message : "Restore failed"),
                                          );
                                        },
                                      },
                                    });
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Delete failed");
                                  }
                                }
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {events.length
                  ? "No rows match this filter."
                  : persistOk
                    ? "No events yet — add Federal Drug and/or Medical Review manually. Nothing is invented."
                    : "Saving disabled until secure backend is enabled."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EventMini({
  ev,
  actor,
  view,
  persistOk,
}: {
  ev: DrugTestEvent;
  actor: string;
  view: boolean;
  persistOk: boolean;
}) {
  const [edit, setEdit] = useState(false);
  if (edit && !view) {
    return (
      <DrugTestEventEditor
        initial={ev}
        disabled={!persistOk}
        onCancel={() => setEdit(false)}
        onSave={async (draft) => {
          try {
            await updateDrugTestEvent(ev.id, draft, actor);
            setEdit(false);
            toast.success("Event updated");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
          }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={view || !persistOk}
      onClick={() => setEdit(true)}
      className="text-left text-xs hover:underline disabled:no-underline disabled:opacity-70"
    >
      <div className="font-bold">{formatDrugDocKind(ev.kind) || "Incomplete"}</div>
      <div className="font-mono text-muted-foreground">{ev.specimenId || "no specimen"}</div>
      <div className="text-muted-foreground">{ev.reason || "no reason"}</div>
    </button>
  );
}
