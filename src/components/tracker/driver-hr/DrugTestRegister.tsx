import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOptionalPortalAccount } from "@/components/tracker/LockGate";
import { useViewMode } from "@/lib/viewmode";
import { parseISO } from "@/lib/alerts";
import {
  addDrugTestEvent,
  deleteDrugTestEvent,
  listDrugTests,
  listDrugTestsAsync,
  subscribeDrugTestMock,
  updateDrugTestEvent,
} from "@/lib/driver-hr/drug-test-api";
import { driverDrugTestModeLabel, getDriverDrugTestMode } from "@/lib/driver-hr/drug-test-mode";
import {
  DRUG_DOC_KIND_LABEL,
  DRUG_PAIR_STATUS_LABEL,
  DRUG_REASON_SUGGESTIONS,
  filterDrugPairs,
  formatDrugDocKind,
  pairDrugTestEvents,
  parseDrugDocKind,
  type DrugDocKind,
  type DrugPairStatus,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";

const STATUS_TONE: Record<DrugPairStatus, string> = {
  matched: "bg-ok-soft text-ok",
  missing_fd: "bg-warn-soft text-warn",
  missing_mr: "bg-warn-soft text-warn",
  specimen_mismatch: "bg-danger-soft text-danger",
  reason_mismatch: "bg-danger-soft text-danger",
  incomplete: "bg-muted text-muted-foreground",
};

/**
 * Drug Test Records — admin-authorized register (not PDF upload).
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
  const [events, setEvents] = useState<DrugTestEvent[]>(() => listDrugTests(driverId, actor));
  const mode = getDriverDrugTestMode();
  void driverName;

  useEffect(() => {
    let alive = true;
    void listDrugTestsAsync(driverId, actor).then((rows) => {
      if (alive) setEvents(rows);
    });
    const unsub = subscribeDrugTestMock(() => setEvents(listDrugTests(driverId, actor)));
    return () => {
      alive = false;
      unsub();
    };
  }, [driverId, actor]);

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
            Federal Drug · Medical Review · {driverDrugTestModeLabel(mode)}
            {events.length ? ` · ${events.length} event${events.length === 1 ? "" : "s"}` : " · none yet"}
          </p>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-foreground/10 px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Records only (no PDF). Pairing uses driver + specimen + reason + collection context.
            Matched means documents line up — not Negative, clearance, or approval. Other Documents /
            medical / duty stay untouched. Partial Federal Drug or Medical Review entries are OK.
          </p>

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
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-bold hover:border-primary"
              >
                <Plus className="size-4" /> Add event
              </button>
            )}
          </div>

          {adding && !view && (
            <EventEditor
              onCancel={() => setAdding(false)}
              onSave={async (draft) => {
                await addDrugTestEvent({ ...draft, driverId }, actor);
                setAdding(false);
                toast.success("Event saved");
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
                      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-bold", STATUS_TONE[row.status])}>
                        {DRUG_PAIR_STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.federal ? <EventMini ev={row.federal} actor={actor} view={view} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {row.medical ? <EventMini ev={row.medical} actor={actor} view={view} /> : <span className="text-muted-foreground">—</span>}
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
                              aria-label="Delete Federal Drug event"
                              onClick={async () => {
                                if (confirm("Delete this Federal Drug event?")) {
                                  await deleteDrugTestEvent(row.federal!.id, actor);
                                }
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                          {row.medical && (
                            <button
                              type="button"
                              aria-label="Delete Medical Review event"
                              onClick={async () => {
                                if (confirm("Delete this Medical Review event?")) {
                                  await deleteDrugTestEvent(row.medical!.id, actor);
                                }
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-danger"
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
                  : "No events yet — add Federal Drug and/or Medical Review manually. Nothing is invented."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EventMini({ ev, actor, view }: { ev: DrugTestEvent; actor: string; view: boolean }) {
  const [edit, setEdit] = useState(false);
  if (edit && !view) {
    return (
      <EventEditor
        initial={ev}
        onCancel={() => setEdit(false)}
        onSave={async (draft) => {
          await updateDrugTestEvent(ev.id, draft, actor);
          setEdit(false);
          toast.success("Event updated");
        }}
      />
    );
  }
  return (
    <button type="button" disabled={view} onClick={() => setEdit(true)} className="text-left text-xs hover:underline">
      <div className="font-bold">{formatDrugDocKind(ev.kind) || "Incomplete"}</div>
      <div className="font-mono text-muted-foreground">{ev.specimenId || "no specimen"}</div>
      <div className="text-muted-foreground">{ev.reason || "no reason"}</div>
    </button>
  );
}

function EventEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: DrugTestEvent;
  onSave: (draft: Omit<DrugTestEvent, "id" | "driverId" | "createdAt">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<DrugDocKind | "">(initial?.kind ?? "");
  const [specimenId, setSpecimenId] = useState(initial?.specimenId ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [collectionContext, setCollectionContext] = useState(initial?.collectionContext ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Doc type</span>
          <select
            value={kind}
            onChange={(e) => setKind(parseDrugDocKind(e.target.value) || ("" as const))}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          >
            <option value="">— (incomplete)</option>
            <option value="federal_drug">{DRUG_DOC_KIND_LABEL.federal_drug}</option>
            <option value="medical_review">{DRUG_DOC_KIND_LABEL.medical_review}</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Event date</span>
          <input
            type="date"
            value={parseISO(eventDate) ? eventDate : ""}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Specimen ID</span>
          <input
            value={specimenId}
            onChange={(e) => setSpecimenId(e.target.value)}
            placeholder="Leading zeros kept (e.g. 01234)"
            className="w-full rounded-lg border px-2 py-1.5 font-mono text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Reason</span>
          <input
            list="drug-reason-suggestions"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Random, Follow-up, …"
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
          <datalist id="drug-reason-suggestions">
            {DRUG_REASON_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-bold text-muted-foreground">Collection context</span>
          <input
            value={collectionContext}
            onChange={(e) => setCollectionContext(e.target.value)}
            placeholder="Collection date / site / batch — part of pairing key"
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-bold text-muted-foreground">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onSave({ kind, specimenId, reason, collectionContext, eventDate, notes })}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-primary-foreground"
        >
          Save event
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-3 py-1.5 text-sm font-bold">
          Cancel
        </button>
      </div>
    </div>
  );
}
