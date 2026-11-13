/**
 * Batch 9 surfaces: Detention & Accessorials board + helpers used from Load editor.
 * Additive — does not rewrite Batch 7/8 cores. No rates/free-time invention; no HR payroll bleed.
 */
import { useEffect, useState } from "react";
import {
  listAccessorials,
  saveAccessorial,
} from "@/dispatch/lib/cloud";
import {
  accessorialKindLabel,
  openAccessorials,
  paymentStatusLabel,
} from "@/dispatch/lib/closeout";
import { statusLabel } from "@/dispatch/lib/status";
import type {
  AccessorialKind,
  AccessorialStatus,
  DispatchAccessorial,
  DispatchLoad,
} from "@/dispatch/lib/types";
import { ACCESSORIAL_KIND_LABELS } from "@/dispatch/lib/types";
import { EmptyHint, SectionHelp } from "./EmptyHint";

const KINDS = Object.keys(ACCESSORIAL_KIND_LABELS) as AccessorialKind[];
const STATUSES: AccessorialStatus[] = ["draft", "submitted", "approved", "denied", "paid", "void"];

export function AccessorialsBoard({
  loads,
  onOpen,
}: {
  loads: DispatchLoad[];
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<DispatchAccessorial[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadId, setLoadId] = useState(loads.find((l) => l.status === "delivered")?.id ?? loads[0]?.id ?? "");
  const [kind, setKind] = useState<AccessorialKind>("detention");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [freeTimeNote, setFreeTimeNote] = useState("Free-time / rate Needs Policy Confirmation — do not invent");

  async function reload() {
    setRows(await listAccessorials());
  }

  useEffect(() => {
    void reload().catch((err) => setError(err instanceof Error ? err.message : "Could not load accessorials."));
  }, [loads]);

  const open = openAccessorials(rows);
  const byLoad = new Map(loads.map((l) => [l.id, l]));

  return (
    <div className="grid gap-3">
      <SectionHelp>
        Detention &amp; accessorials are desk claims with <strong>manual</strong> amount/hours only. Never invent
        rates or free-time. Never auto-post to Admin expenses or payroll. Claim Paid ≠ load Closed.
      </SectionHelp>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="dispatch-panel grid gap-2">
        <h2 className="text-base font-semibold text-[color:var(--dispatch-navy)]">Add claim</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            Load
            <select className="dispatch-field" value={loadId} onChange={(e) => setLoadId(e.target.value)}>
              {loads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.load_number} · {statusLabel(l.status)} · pay {paymentStatusLabel(l.payment_status)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Kind
            <select className="dispatch-field" value={kind} onChange={(e) => setKind(e.target.value as AccessorialKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {ACCESSORIAL_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Description
            <input
              className="dispatch-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened (manual)"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Amount (manual — blank = Needs Policy)
            <input
              className="dispatch-field"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Leave blank — never invent rate"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Hours claimed (manual)
            <input
              className="dispatch-field"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Optional — not free-time calc"
            />
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Free-time / rate note
            <input
              className="dispatch-field"
              value={freeTimeNote}
              onChange={(e) => setFreeTimeNote(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="dispatch-btn-primary w-fit"
          disabled={busy || !loadId}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const amount_manual = amount.trim() === "" ? null : Number(amount);
              const hours_manual = hours.trim() === "" ? null : Number(hours);
              await saveAccessorial({
                load_id: loadId,
                kind,
                description,
                amount_manual,
                hours_manual,
                free_time_note: freeTimeNote.trim() || null,
                status: "draft",
              });
              setDescription("");
              setAmount("");
              setHours("");
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save accessorial.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save accessorial
        </button>
      </section>

      <section className="dispatch-panel">
        <h2 className="mb-2 text-base font-semibold text-[color:var(--dispatch-navy)]">
          Open claims ({open.length})
        </h2>
        {!open.length ? (
          <EmptyHint>No open detention/accessorial claims.</EmptyHint>
        ) : (
          <ul className="divide-y divide-[color:var(--dispatch-border)]">
            {open.map((a) => {
              const load = byLoad.get(a.load_id);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-semibold">
                      {accessorialKindLabel(a.kind)} · {a.status}
                      {load ? ` · ${load.load_number}` : ""}
                    </p>
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {a.description}
                      {" · "}
                      {a.amount_manual == null ? "amount blank / Needs Policy" : `USD ${a.amount_manual}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="dispatch-field"
                      value={a.status}
                      disabled={busy}
                      onChange={async (e) => {
                        setBusy(true);
                        setError(null);
                        try {
                          await saveAccessorial({
                            ...a,
                            status: e.target.value as AccessorialStatus,
                            description: a.description,
                            kind: a.kind,
                            load_id: a.load_id,
                          });
                          await reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Update failed.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="dispatch-btn-primary" onClick={() => onOpen(a.load_id)}>
                      Update Load
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
