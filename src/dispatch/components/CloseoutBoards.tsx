/**
 * Batch 9 surfaces: Detention & Accessorials board + helpers used from Load editor.
 * Additive — does not rewrite Batch 7/8 cores. No rates/free-time invention; no HR payroll bleed.
 */
import { useEffect, useRef, useState } from "react";
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

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

const KINDS = Object.keys(ACCESSORIAL_KIND_LABELS) as AccessorialKind[];
const STATUSES: AccessorialStatus[] = ["draft", "submitted", "approved", "denied", "paid", "void"];

export function AccessorialsBoard({
  loads,
  onOpen,
}: {
  loads: DispatchLoad[];
  onOpen: (id: string) => void;
}) {
  const safeLoads = Array.isArray(loads) ? loads : [];
  const [rows, setRows] = useState<DispatchAccessorial[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadId, setLoadId] = useState(
    safeLoads.find((l) => l.status === "delivered")?.id ?? safeLoads[0]?.id ?? "",
  );
  const [kind, setKind] = useState<AccessorialKind>("detention");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [freeTimeNote, setFreeTimeNote] = useState("Free-time / rate Needs Policy Confirmation — do not invent");
  const descriptionRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const freeTimeNoteRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const next = await listAccessorials();
    setRows(Array.isArray(next) ? next : []);
  }

  useEffect(() => {
    void reload().catch((err) => setError(err instanceof Error ? err.message : "Could not load accessorials."));
  }, [loads]);

  const open = openAccessorials(rows);
  const byLoad = new Map(safeLoads.map((l) => [l.id, l]));

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
            <select className="dispatch-field" value={asText(loadId)} onChange={(e) => setLoadId(e.target.value)}>
              {safeLoads.map((l) => (
                <option key={asText(l.id)} value={asText(l.id)}>
                  {asText(l.load_number)} · {statusLabel(l.status)} · pay{" "}
                  {paymentStatusLabel(l.payment_status)}
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
              ref={descriptionRef}
              data-testid="dispatch-accessorial-description"
              className="dispatch-field"
              value={asText(description)}
              onChange={(e) => setDescription(e.target.value)}
              onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
              placeholder="What happened (manual)"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Amount (manual — blank = Needs Policy)
            <input
              ref={amountRef}
              data-testid="dispatch-accessorial-amount"
              className="dispatch-field"
              inputMode="decimal"
              value={asText(amount)}
              onChange={(e) => setAmount(e.target.value)}
              onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
              placeholder="Leave blank — never invent rate"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Hours claimed (manual)
            <input
              ref={hoursRef}
              data-testid="dispatch-accessorial-hours"
              className="dispatch-field"
              inputMode="decimal"
              value={asText(hours)}
              onChange={(e) => setHours(e.target.value)}
              onInput={(e) => setHours((e.target as HTMLInputElement).value)}
              placeholder="Optional — not free-time calc"
            />
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Free-time / rate note
            <input
              ref={freeTimeNoteRef}
              data-testid="dispatch-accessorial-freetime"
              className="dispatch-field"
              value={asText(freeTimeNote)}
              onChange={(e) => setFreeTimeNote(e.target.value)}
              onInput={(e) => setFreeTimeNote((e.target as HTMLInputElement).value)}
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
              const nextDesc = (asText(description).trim() || descriptionRef.current?.value || "").trim();
              const nextAmount = (asText(amount).trim() || amountRef.current?.value || "").trim();
              const nextHours = (asText(hours).trim() || hoursRef.current?.value || "").trim();
              const nextFree = (asText(freeTimeNote).trim() || freeTimeNoteRef.current?.value || "").trim();
              const amount_manual = nextAmount === "" ? null : Number(nextAmount);
              const hours_manual = nextHours === "" ? null : Number(nextHours);
              await saveAccessorial({
                load_id: loadId,
                kind,
                description: nextDesc,
                amount_manual,
                hours_manual,
                free_time_note: nextFree || null,
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
                      {accessorialKindLabel(a.kind)} · {asText(a.status)}
                      {load ? ` · ${asText(load.load_number)}` : ""}
                    </p>
                    <p className="text-xs text-[color:var(--dispatch-muted)]">
                      {asText(a.description)}
                      {" · "}
                      {a.amount_manual == null
                        ? "amount blank / Needs Policy"
                        : `USD ${a.amount_manual}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="dispatch-field"
                      value={asText(a.status)}
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
