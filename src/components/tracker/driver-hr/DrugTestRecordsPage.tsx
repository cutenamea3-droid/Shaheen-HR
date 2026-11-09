/**
 * Sidebar Drug Test Records — searchable multi-driver register.
 * Same secure RPCs as the in-card Drug panel. Matched ≠ clearance.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Lock, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOptionalPortalAccount } from "@/components/tracker/LockGate";
import { useViewMode } from "@/lib/viewmode";
import { useData } from "@/lib/store";
import {
  addDrugTestEvent,
  deleteDrugTestEvent,
  listDrugTestsForDrivers,
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
  DRUG_DOC_KIND_LABEL,
  DRUG_PAIR_STATUS_LABEL,
  formatDrugDocKind,
  newTestingEventId,
  pairDrugTestEvents,
  type DrugDocKind,
  type DrugPairRow,
  type DrugPairStatus,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";
import { filterRosterDrivers, listRosterDrivers } from "@/lib/driver-hr/roster-drivers";
import { DrugTestEventEditor, DRUG_STATUS_TONE, type DrugEventDraft } from "./DrugTestForm";

type TableRow = DrugPairRow & { driverId: string; driverName: string };

export function DrugTestRecordsPage() {
  const role = useOptionalPortalAccount()?.account.role;
  const actor = useOptionalPortalAccount()?.account.email ?? "portal";
  const view = useViewMode();
  const isAdmin = role === "admin";
  const data = useData();
  const roster = useMemo(() => listRosterDrivers(data), [data]);
  const mode = getDriverDrugTestMode();
  const persistOk = canPersistDrugTests();
  const blocked = drugTestPersistBlockedReason(mode);

  const [events, setEvents] = useState<DrugTestEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<DrugPairStatus | "all">("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [groupByDriver, setGroupByDriver] = useState(false);
  /** Add panel collapsed by default. */
  const [adding, setAdding] = useState(false);
  const [addFormKey, setAddFormKey] = useState(0);
  const [driverPickQ, setDriverPickQ] = useState("");
  const [pickedDriverId, setPickedDriverId] = useState("");
  const [addKind, setAddKind] = useState<DrugDocKind | "">("federal_drug");
  const [viewRow, setViewRow] = useState<TableRow | null>(null);
  const [editEv, setEditEv] = useState<DrugTestEvent | null>(null);
  const [addSideFor, setAddSideFor] = useState<{
    driverId: string;
    testingEventId: string;
    kind: DrugDocKind;
  } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{ id: string; label: string } | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of roster) m.set(d.driverId, d.name || d.driverId);
    return m;
  }, [roster]);

  useEffect(() => {
    let alive = true;
    const reload = () => {
      if (!persistOk) {
        if (alive) {
          setEvents([]);
          setLoadError(blocked);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      void listDrugTestsForDrivers(
        roster.map((d) => d.driverId),
        actor,
      ).then((res) => {
        if (!alive) return;
        setEvents(res.events);
        setLoadError(res.error);
        setLoading(false);
      });
    };
    reload();
    const unsub = subscribeDrugTestMock(reload);
    return () => {
      alive = false;
      unsub();
    };
  }, [roster, actor, persistOk, blocked]);

  const pairsByDriver = useMemo(() => {
    const byDriver = new Map<string, DrugTestEvent[]>();
    for (const ev of events) {
      const list = byDriver.get(ev.driverId) ?? [];
      list.push(ev);
      byDriver.set(ev.driverId, list);
    }
    const rows: TableRow[] = [];
    for (const [driverId, list] of byDriver) {
      const paired = pairDrugTestEvents(list);
      for (const p of paired) {
        rows.push({
          ...p,
          driverId,
          driverName: nameById.get(driverId) ?? driverId,
        });
      }
    }
    rows.sort((a, b) => {
      const da = a.eventDate || a.collectionContext || "";
      const db = b.eventDate || b.collectionContext || "";
      if (da !== db) return db.localeCompare(da);
      return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" });
    });
    return rows;
  }, [events, nameById]);

  const reasonOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of pairsByDriver) if (r.reason.trim()) s.add(r.reason.trim());
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [pairsByDriver]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = pairsByDriver.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [
        r.driverName,
        r.driverId,
        r.specimenId,
        r.reason,
        r.collectionContext,
        r.eventDate,
        r.testingEventId,
        DRUG_PAIR_STATUS_LABEL[r.status],
        r.federal ? DRUG_DOC_KIND_LABEL.federal_drug : "",
        r.medical ? DRUG_DOC_KIND_LABEL.medical_review : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    if (reasonFilter !== "all") {
      rows = rows.filter((r) => r.reason.trim().toLowerCase() === reasonFilter.toLowerCase());
    }
    return rows;
  }, [pairsByDriver, statusFilter, q, reasonFilter]);

  /** Real totals from loaded events (not filter-scoped). */
  const totalEvents = pairsByDriver.length;
  const totalDrivers = useMemo(() => new Set(pairsByDriver.map((r) => r.driverId)).size, [pairsByDriver]);
  const showingEvents = filtered.length;
  const showingDrivers = useMemo(() => new Set(filtered.map((r) => r.driverId)).size, [filtered]);
  const isFiltered =
    q.trim() !== "" || statusFilter !== "all" || reasonFilter !== "all";

  const grouped = useMemo(() => {
    if (!groupByDriver) return null;
    const map = new Map<string, TableRow[]>();
    for (const r of filtered) {
      const list = map.get(r.driverId) ?? [];
      list.push(r);
      map.set(r.driverId, list);
    }
    return [...map.entries()].sort((a, b) => {
      const na = nameById.get(a[0]) ?? a[0];
      const nb = nameById.get(b[0]) ?? b[0];
      return na.localeCompare(nb, undefined, { sensitivity: "base" });
    });
  }, [filtered, groupByDriver, nameById]);

  const driverChoices = useMemo(
    () => filterRosterDrivers(roster, driverPickQ),
    [roster, driverPickQ],
  );

  const closeAdd = () => {
    setAdding(false);
    setDriverPickQ("");
    setPickedDriverId("");
    setAddKind("federal_drug");
  };

  const saveNewEvent = async (draft: DrugEventDraft, addAnother: boolean) => {
    if (!persistOk) {
      toast.error(blocked ?? "Saving disabled");
      return;
    }
    if (!pickedDriverId) {
      toast.error("Pick a driver first");
      return;
    }
    // New independent events always get a fresh id — never overwrite an existing testing_event_id.
    const testingEventId = draft.testingEventId.trim() || newTestingEventId();
    try {
      await addDrugTestEvent(
        {
          ...draft,
          driverId: pickedDriverId,
          testingEventId,
        },
        actor,
      );
      toast.success(addAnother ? "Event saved — add another" : "Event saved");
      if (addAnother) {
        // Keep driver; remount editor blank with a new independent testing event.
        setAddKind(draft.kind || "federal_drug");
        setAddFormKey((k) => k + 1);
      } else {
        closeAdd();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const softDelete = async (ev: DrugTestEvent, label: string) => {
    if (!persistOk) {
      toast.error(blocked ?? "Saving disabled");
      return;
    }
    if (!confirm(`Soft-delete this ${label}? History stays recoverable.`)) return;
    try {
      await deleteDrugTestEvent(ev.id, actor);
      setPendingRestore({ id: ev.id, label });
      toast.success(`${label} soft-deleted`, {
        action: {
          label: "Restore",
          onClick: () => {
            void restoreDrugTestEvent(ev.id, actor)
              .then(() => {
                setPendingRestore(null);
                toast.success("Restored");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Restore failed"));
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-foreground/10 bg-card p-6 text-[15px] text-muted-foreground">
        <Lock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground sm:text-[22px]">Drug Test Records</h2>
          <p className="mt-1">Authorized admin accounts only. Not stored in shared driver JSON.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-3 overflow-x-hidden">
      {/* Thin Shaheen navy/orange summary — real (unfiltered) counts */}
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--brand-slate)] px-3 py-2.5 text-sidebar-foreground shadow-sm sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--brand-orange)] sm:text-[22px]">
              Drug Test Records
            </h2>
            <span className="text-xs font-semibold text-sidebar-foreground/70 sm:text-[13px]">
              CCF · MRO · Matched ≠ clearance
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-sidebar-foreground/65 sm:text-[13px]">
            Paperwork pairing only — not Negative, clearance, or approval. {driverDrugTestModeLabel(mode)}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-right">
          <div className="leading-tight">
            <div className="text-xl font-extrabold tabular-nums text-[var(--brand-orange)] sm:text-[22px]">
              {totalEvents}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              event{totalEvents === 1 ? "" : "s"}
            </div>
          </div>
          <div className="h-8 w-px bg-sidebar-foreground/20" aria-hidden />
          <div className="leading-tight">
            <div className="text-xl font-extrabold tabular-nums text-sidebar-foreground sm:text-[22px]">
              {totalDrivers}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              driver{totalDrivers === 1 ? "" : "s"}
            </div>
          </div>
          {isFiltered && (
            <div className="hidden rounded bg-card/10 px-2 py-1 text-xs font-semibold text-sidebar-foreground/80 sm:block">
              Showing {showingEvents}/{totalEvents} · {showingDrivers} driver
              {showingDrivers === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </header>

      {(blocked || loadError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2.5 text-[15px] font-semibold text-danger"
        >
          {blocked ?? loadError}
          {!persistOk && (
            <span className="mt-1 block text-[14px] font-normal text-danger/90">
              Enable <code className="font-mono">VITE_DRIVER_DRUG_TESTS_SECURE=1</code> on Cloudflare Pages
              (Preview/Production) after Driver SQL is applied, then redeploy. Do not use mock/localStorage as a
              real save.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1 basis-[14rem]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search driver, specimen, reason, status…"
            className="w-full rounded-lg border bg-card py-2 pr-3 pl-9 text-[14px]"
            aria-label="Search drug test records"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DrugPairStatus | "all")}
          className="rounded-lg border bg-card px-2.5 py-2 text-[14px] font-semibold"
          aria-label="Pair status filter"
        >
          <option value="all">All pair statuses</option>
          {(Object.keys(DRUG_PAIR_STATUS_LABEL) as DrugPairStatus[]).map((s) => (
            <option key={s} value={s}>
              {DRUG_PAIR_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="rounded-lg border bg-card px-2.5 py-2 text-[14px] font-semibold"
          aria-label="Reason filter"
        >
          <option value="all">All reasons</option>
          {reasonOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[14px] font-semibold">
          <input
            type="checkbox"
            checked={groupByDriver}
            onChange={(e) => setGroupByDriver(e.target.checked)}
          />
          Group by driver
        </label>
        {!view && (
          <button
            type="button"
            disabled={!persistOk}
            aria-expanded={adding}
            onClick={() => {
              if (adding) {
                closeAdd();
              } else {
                setAdding(true);
                setAddFormKey((k) => k + 1);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-orange)] px-3 py-2 text-[14px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {adding ? <X className="size-4" /> : <Plus className="size-4" />}
            {adding ? "Close" : "Add"}
          </button>
        )}
        {pendingRestore && persistOk && !view && (
          <button
            type="button"
            onClick={() => {
              void restoreDrugTestEvent(pendingRestore.id, actor)
                .then(() => {
                  setPendingRestore(null);
                  toast.success("Restored");
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Restore failed"));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[14px] font-bold"
          >
            <RotateCcw className="size-4" /> Restore last
          </button>
        )}
      </div>

      {/* Compact Add — collapsed by default; CCF-first or MRO-first OK */}
      {adding && !view && (
        <div className="w-full min-w-0 space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--brand-orange)_35%,transparent)] bg-card px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-[var(--brand-slate)] sm:text-lg">
              Add drug test event
            </h3>
            <span className="text-xs font-semibold text-muted-foreground sm:text-[13px]">
              CCF-first or MRO-first · new testing event each Add Another
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-[13px] sm:col-span-2 lg:col-span-2">
              <span className="mb-1 block font-bold text-muted-foreground">Driver (searchable)</span>
              <input
                value={driverPickQ}
                onChange={(e) => setDriverPickQ(e.target.value)}
                placeholder="Type driver name…"
                className="mb-1.5 w-full rounded-lg border px-2.5 py-1.5 text-[14px]"
                aria-label="Search drivers"
              />
              <select
                value={pickedDriverId}
                onChange={(e) => setPickedDriverId(e.target.value)}
                className="w-full rounded-lg border px-2.5 py-1.5 text-[14px]"
                aria-label="Select driver"
              >
                <option value="">Select driver…</option>
                {driverChoices.map((d) => (
                  <option key={d.driverId} value={d.driverId}>
                    {d.name || d.driverId}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[13px]">
              <span className="mb-1 block font-bold text-muted-foreground">Starting doc</span>
              <select
                value={addKind}
                onChange={(e) => setAddKind((e.target.value || "") as DrugDocKind | "")}
                className="w-full rounded-lg border px-2.5 py-1.5 text-[14px]"
              >
                <option value="federal_drug">{DRUG_DOC_KIND_LABEL.federal_drug}</option>
                <option value="medical_review">{DRUG_DOC_KIND_LABEL.medical_review}</option>
                <option value="">Incomplete (no kind yet)</option>
              </select>
            </label>
          </div>
          {pickedDriverId ? (
            <DrugTestEventEditor
              key={addFormKey}
              compact
              showAddAnother
              disabled={!persistOk}
              initial={{
                id: "",
                driverId: pickedDriverId,
                testingEventId: "",
                kind: addKind,
                specimenId: "",
                reason: "",
                collectionContext: "",
                eventDate: "",
                notes: "",
                createdAt: 0,
              }}
              onCancel={closeAdd}
              onSave={async (draft, opts) => {
                await saveNewEvent(draft, Boolean(opts?.addAnother));
              }}
            />
          ) : (
            <p className="text-[15px] text-muted-foreground">Pick a driver to continue.</p>
          )}
        </div>
      )}

      {addSideFor && !view && (
        <div className="w-full min-w-0 rounded-lg border border-[color-mix(in_srgb,var(--brand-orange)_35%,transparent)] bg-card px-3 py-2.5 sm:px-4">
          <h3 className="mb-2 font-display text-base font-extrabold text-[var(--brand-slate)] sm:text-lg">
            Add {formatDrugDocKind(addSideFor.kind)} to testing event
          </h3>
          <DrugTestEventEditor
            compact
            disabled={!persistOk}
            initial={{
              id: "",
              driverId: addSideFor.driverId,
              testingEventId: addSideFor.testingEventId,
              kind: addSideFor.kind,
              specimenId: "",
              reason: "",
              collectionContext: "",
              eventDate: "",
              notes: "",
              createdAt: 0,
            }}
            onCancel={() => setAddSideFor(null)}
            onSave={async (draft) => {
              try {
                // Link to the existing testing event — do not mint a replacement id.
                await addDrugTestEvent(
                  {
                    ...draft,
                    driverId: addSideFor.driverId,
                    testingEventId: addSideFor.testingEventId,
                    kind: addSideFor.kind,
                  },
                  actor,
                );
                setAddSideFor(null);
                toast.success("Event saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              }
            }}
          />
        </div>
      )}

      {editEv && !view && (
        <div className="w-full min-w-0 rounded-lg border border-[color-mix(in_srgb,var(--brand-orange)_35%,transparent)] bg-card px-3 py-2.5 sm:px-4">
          <h3 className="mb-2 font-display text-base font-extrabold text-[var(--brand-slate)] sm:text-lg">Edit event</h3>
          <DrugTestEventEditor
            compact
            disabled={!persistOk}
            initial={editEv}
            linkOptions={events
              .filter((e) => e.driverId === editEv.driverId && e.kind === "federal_drug" && e.testingEventId)
              .map((e) => ({
                id: e.testingEventId,
                label: `Link FD ${e.specimenId || "incomplete"} · ${e.reason || "—"}`,
              }))}
            onCancel={() => setEditEv(null)}
            onSave={async (draft) => {
              try {
                await updateDrugTestEvent(editEv.id, draft, actor);
                setEditEv(null);
                toast.success("Event updated");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Update failed");
              }
            }}
          />
        </div>
      )}

      {viewRow && (
        <div className="w-full min-w-0 rounded-lg border bg-card px-3 py-2.5 text-[15px] sm:px-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-[var(--brand-slate)] sm:text-lg">View testing event</h3>
            <button
              type="button"
              className="rounded-lg border px-2.5 py-1 text-[14px] font-bold"
              onClick={() => setViewRow(null)}
            >
              Close
            </button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Driver</dt>
              <dd>{viewRow.driverName}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Pair status</dt>
              <dd>{DRUG_PAIR_STATUS_LABEL[viewRow.status]}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Reason</dt>
              <dd>{viewRow.reason || "—"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Collection date</dt>
              <dd>{viewRow.eventDate || viewRow.collectionContext || "—"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Specimen</dt>
              <dd className="font-mono">{viewRow.specimenId || "—"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Testing event id</dt>
              <dd className="font-mono text-[13px]">{viewRow.testingEventId || "—"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Federal Drug (CCF)</dt>
              <dd>{viewRow.federal ? formatDrugDocKind(viewRow.federal.kind) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Medical Review (MRO)</dt>
              <dd>{viewRow.medical ? formatDrugDocKind(viewRow.medical.kind) : "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground sm:text-[13px]">
            Matched means documents line up for this testing event — not clearance or approval.
          </p>
        </div>
      )}

      {/* Full-width table */}
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[920px] border-collapse text-[15px]">
          <thead className="bg-[color-mix(in_srgb,var(--brand-slate)_8%,white)] text-left text-[13px] font-extrabold tracking-wider text-[var(--brand-slate)] uppercase">
            <tr>
              <th className="px-3 py-2.5">Driver</th>
              <th className="px-3 py-2.5">Reason</th>
              <th className="px-3 py-2.5">Collection Date</th>
              <th className="px-3 py-2.5">Specimen</th>
              <th className="px-3 py-2.5">Federal Drug</th>
              <th className="px-3 py-2.5">Medical Review</th>
              <th className="px-3 py-2.5">Pair Status</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-muted-foreground">
                  Loading drug test records…
                </td>
              </tr>
            )}
            {!loading &&
              !groupByDriver &&
              filtered.map((row) => (
                <RecordRow
                  key={`${row.driverId}_${row.id}`}
                  row={row}
                  view={view}
                  persistOk={persistOk}
                  onView={() => setViewRow(row)}
                  onEdit={(ev) => setEditEv(ev)}
                  onAddCcf={() =>
                    setAddSideFor({
                      driverId: row.driverId,
                      // Prefer existing event id; only mint when the row has none.
                      testingEventId: row.testingEventId || newTestingEventId(),
                      kind: "federal_drug",
                    })
                  }
                  onAddMro={() =>
                    setAddSideFor({
                      driverId: row.driverId,
                      testingEventId: row.testingEventId || newTestingEventId(),
                      kind: "medical_review",
                    })
                  }
                  onDelete={softDelete}
                />
              ))}
            {!loading &&
              groupByDriver &&
              grouped?.flatMap(([driverId, rows]) => [
                <tr key={`g_${driverId}`} className="border-t border-foreground/10 bg-muted/40">
                  <td colSpan={8} className="px-3 py-2.5 text-base font-extrabold text-foreground">
                    {nameById.get(driverId) ?? driverId}
                    <span className="ml-2 text-[13px] font-semibold text-muted-foreground">
                      {rows.length} event{rows.length === 1 ? "" : "s"}
                    </span>
                  </td>
                </tr>,
                ...rows.map((row) => (
                  <RecordRow
                    key={`${row.driverId}_${row.id}`}
                    row={row}
                    hideDriver
                    view={view}
                    persistOk={persistOk}
                    onView={() => setViewRow(row)}
                    onEdit={(ev) => setEditEv(ev)}
                    onAddCcf={() =>
                      setAddSideFor({
                        driverId: row.driverId,
                        testingEventId: row.testingEventId || newTestingEventId(),
                        kind: "federal_drug",
                      })
                    }
                    onAddMro={() =>
                      setAddSideFor({
                        driverId: row.driverId,
                        testingEventId: row.testingEventId || newTestingEventId(),
                        kind: "medical_review",
                      })
                    }
                    onDelete={softDelete}
                  />
                )),
              ])}
          </tbody>
        </table>
        {!loading && !filtered.length && (
          <p className="px-3 py-6 text-[15px] text-muted-foreground">
            {events.length
              ? "No rows match this filter."
              : persistOk
                ? "No drug test events yet — use + Add with a searchable driver."
                : "Saving disabled until secure backend is enabled."}
          </p>
        )}
      </div>

      {!adding && !view && persistOk && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground sm:text-[13px]">
          <ChevronDown className="size-3.5" aria-hidden />
          Add stays collapsed until you need it — CCF-first or MRO-first both work.
        </p>
      )}
    </div>
  );
}

function RecordRow({
  row,
  hideDriver,
  view,
  persistOk,
  onView,
  onEdit,
  onAddCcf,
  onAddMro,
  onDelete,
}: {
  row: TableRow;
  hideDriver?: boolean;
  view: boolean;
  persistOk: boolean;
  onView: () => void;
  onEdit: (ev: DrugTestEvent) => void;
  onAddCcf: () => void;
  onAddMro: () => void;
  onDelete: (ev: DrugTestEvent, label: string) => void;
}) {
  return (
    <tr className="border-t border-foreground/10 align-top">
      <td className="px-3 py-2.5 font-semibold">{hideDriver ? "" : row.driverName}</td>
      <td className="px-3 py-2.5">{row.reason || "—"}</td>
      <td className="px-3 py-2.5 text-[14px]">{row.eventDate || row.collectionContext || "—"}</td>
      <td className="px-3 py-2.5 font-mono text-[14px] font-semibold">{row.specimenId || "—"}</td>
      <td className="px-3 py-2.5 text-[14px]">
        {row.federal ? (
          <button
            type="button"
            disabled={view || !persistOk}
            onClick={() => onEdit(row.federal!)}
            className="text-left hover:underline disabled:no-underline"
          >
            <div className="font-bold">{formatDrugDocKind(row.federal.kind)}</div>
            <div className="font-mono text-muted-foreground">{row.federal.specimenId || "no specimen"}</div>
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[14px]">
        {row.medical ? (
          <button
            type="button"
            disabled={view || !persistOk}
            onClick={() => onEdit(row.medical!)}
            className="text-left hover:underline disabled:no-underline"
          >
            <div className="font-bold">{formatDrugDocKind(row.medical.kind)}</div>
            <div className="font-mono text-muted-foreground">{row.medical.specimenId || "no specimen"}</div>
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[13px] font-bold", DRUG_STATUS_TONE[row.status])}>
          {DRUG_PAIR_STATUS_LABEL[row.status]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            title="View"
            aria-label="View testing event"
            onClick={onView}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Eye className="size-3.5" />
          </button>
          {!view && (
            <>
              {(row.federal || row.medical) && (
                <button
                  type="button"
                  title="Edit"
                  aria-label="Edit event"
                  disabled={!persistOk}
                  onClick={() => onEdit(row.federal ?? row.medical!)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              {!row.federal && (
                <button
                  type="button"
                  title="Add CCF"
                  aria-label="Add Federal Drug CCF"
                  disabled={!persistOk}
                  onClick={onAddCcf}
                  className="rounded px-1.5 py-1 text-[13px] font-extrabold tracking-wide text-[var(--brand-orange)] hover:bg-accent disabled:opacity-40"
                >
                  +CCF
                </button>
              )}
              {!row.medical && (
                <button
                  type="button"
                  title="Add MRO"
                  aria-label="Add Medical Review MRO"
                  disabled={!persistOk}
                  onClick={onAddMro}
                  className="rounded px-1.5 py-1 text-[13px] font-extrabold tracking-wide text-[var(--brand-orange)] hover:bg-accent disabled:opacity-40"
                >
                  +MRO
                </button>
              )}
              {row.federal && (
                <button
                  type="button"
                  title="Soft-delete Federal Drug"
                  aria-label="Soft-delete Federal Drug"
                  disabled={!persistOk}
                  onClick={() => onDelete(row.federal!, "Federal Drug (CCF)")}
                  className="rounded p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
              {row.medical && (
                <button
                  type="button"
                  title="Soft-delete Medical Review"
                  aria-label="Soft-delete Medical Review"
                  disabled={!persistOk}
                  onClick={() => onDelete(row.medical!, "Medical Review (MRO)")}
                  className="rounded p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
