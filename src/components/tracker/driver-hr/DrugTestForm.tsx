/**
 * Shared Drug Test event editor (Federal Drug / Medical Review).
 * Records only — no PDF. Matched ≠ clearance.
 * Add flows may enable Smart Hybrid Pairing Mode (Automatic / Manual / New Separate).
 */
import { useMemo, useState } from "react";
import { parseISO } from "@/lib/alerts";
import {
  listManualMatchOptions,
  type MatchCandidate,
  type PairingMode,
} from "@/lib/driver-hr/drug-test-matching";
import {
  DRUG_DOC_KIND_LABEL,
  DRUG_REASON_SUGGESTIONS,
  parseDrugDocKind,
  type DrugDocKind,
  type DrugPairStatus,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";

export const DRUG_STATUS_TONE: Record<DrugPairStatus, string> = {
  matched: "bg-ok-soft text-ok",
  missing_fd: "bg-warn-soft text-warn",
  missing_mr: "bg-warn-soft text-warn",
  specimen_mismatch: "bg-danger-soft text-danger",
  reason_mismatch: "bg-danger-soft text-danger",
  incomplete: "bg-muted text-muted-foreground",
};

export type DrugEventDraft = Omit<DrugTestEvent, "id" | "driverId" | "createdAt" | "deletedAt">;

export type DrugEventSaveOpts = {
  addAnother?: boolean;
  pairingMode?: PairingMode;
  manualTestingEventId?: string;
  selectedTestingEventId?: string;
  confirmSeparate?: boolean;
};

const PAIRING_MODE_LABEL: Record<PairingMode, string> = {
  automatic: "Automatic Matching",
  manual: "Manual Matching",
  separate: "New Separate Test",
};

export function DrugTestEventEditor({
  initial,
  linkOptions = [],
  disabled = false,
  showAddAnother = false,
  compact = false,
  enablePairing = false,
  existingEvents = [],
  driverId = "",
  pairingHint,
  ambiguousCandidates,
  similarCandidates,
  conflictMessage,
  onSave,
  onCancel,
}: {
  initial?: DrugTestEvent;
  linkOptions?: { id: string; label: string }[];
  disabled?: boolean;
  /** Show "Save & Add Another" (sidebar Add flow). */
  showAddAnother?: boolean;
  /** Denser 2–3 column layout for the full-width page. */
  compact?: boolean;
  /** Smart Hybrid pairing radios (Add New only). */
  enablePairing?: boolean;
  existingEvents?: DrugTestEvent[];
  driverId?: string;
  pairingHint?: string | null | undefined;
  ambiguousCandidates?: MatchCandidate[] | undefined;
  similarCandidates?: MatchCandidate[] | undefined;
  conflictMessage?: string | null | undefined;
  onSave: (draft: DrugEventDraft, opts?: DrugEventSaveOpts) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<DrugDocKind | "">(initial?.kind ?? "");
  const [specimenId, setSpecimenId] = useState(initial?.specimenId ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [collectionContext, setCollectionContext] = useState(initial?.collectionContext ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [testingEventId, setTestingEventId] = useState(initial?.testingEventId ?? "");
  const [busy, setBusy] = useState(false);
  const [pairingMode, setPairingMode] = useState<PairingMode>("automatic");
  const [manualTestingEventId, setManualTestingEventId] = useState("");
  const [selectedTestingEventId, setSelectedTestingEventId] = useState("");
  const [confirmSeparate, setConfirmSeparate] = useState(false);
  const [manualQ, setManualQ] = useState("");

  const manualOptions = useMemo(() => {
    if (!enablePairing || !driverId) return [] as MatchCandidate[];
    const all = listManualMatchOptions(driverId, kind, existingEvents);
    const q = manualQ.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.label.toLowerCase().includes(q));
  }, [enablePairing, driverId, kind, existingEvents, manualQ]);

  const submit = (addAnother: boolean) => {
    setBusy(true);
    void Promise.resolve(
      onSave(
        { kind, specimenId, reason, collectionContext, eventDate, notes, testingEventId },
        enablePairing
          ? {
              addAnother,
              pairingMode,
              manualTestingEventId,
              selectedTestingEventId,
              confirmSeparate,
            }
          : { addAnother },
      ),
    ).finally(() => setBusy(false));
  };

  const fieldCls = compact
    ? "w-full rounded-lg border px-2.5 py-1.5 text-[14px]"
    : "w-full rounded-lg border px-2 py-1.5 text-sm";
  const labelCls = compact ? "block text-[13px]" : "block text-xs";

  return (
    <div className={compact ? "space-y-2" : "space-y-2 rounded-lg border border-primary/30 bg-card p-3"}>
      {enablePairing && (
        <fieldset className="space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--brand-slate)_20%,transparent)] bg-[color-mix(in_srgb,var(--brand-slate)_4%,white)] px-3 py-2.5">
          <legend className="px-1 text-[13px] font-extrabold tracking-wide text-[var(--brand-slate)] uppercase">
            Pairing Mode
          </legend>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-4">
            {(Object.keys(PAIRING_MODE_LABEL) as PairingMode[]).map((m) => (
              <label
                key={m}
                className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-semibold text-[var(--brand-slate)]"
              >
                <input
                  type="radio"
                  name="drug-pairing-mode"
                  value={m}
                  checked={pairingMode === m}
                  disabled={disabled || busy}
                  onChange={() => {
                    setPairingMode(m);
                    setConfirmSeparate(false);
                    setSelectedTestingEventId("");
                    if (m !== "manual") setManualTestingEventId("");
                  }}
                  className="accent-[var(--brand-orange)]"
                />
                {PAIRING_MODE_LABEL[m]}
                {m === "automatic" ? (
                  <span className="text-[13px] font-normal text-muted-foreground">(default)</span>
                ) : null}
              </label>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground">
            Automatic attaches when exactly one open event matches specimen + reason + dates.
            Manual lets you pick. New Separate always creates a new testing event.
            Matched ≠ clearance.
          </p>

          {pairingMode === "manual" && (
            <div className="space-y-1.5">
              <label className={labelCls}>
                <span className="mb-1 block font-bold text-muted-foreground">
                  Search this driver’s events
                </span>
                <input
                  value={manualQ}
                  disabled={disabled || busy}
                  onChange={(e) => setManualQ(e.target.value)}
                  placeholder="Specimen, reason, date, missing doc…"
                  className={fieldCls}
                  aria-label="Search events for manual matching"
                />
              </label>
              <label className={labelCls}>
                <span className="mb-1 block font-bold text-muted-foreground">
                  Attach to testing event
                </span>
                <select
                  value={manualTestingEventId}
                  disabled={disabled || busy || !kind}
                  onChange={(e) => setManualTestingEventId(e.target.value)}
                  className={fieldCls}
                  aria-label="Select testing event for manual match"
                >
                  <option value="">Select event…</option>
                  {manualOptions.map((c) => (
                    <option
                      key={c.testingEventId}
                      value={c.testingEventId}
                      disabled={c.hasIncomingKind}
                    >
                      {c.label}
                      {c.hasIncomingKind ? " · BLOCKED (doc already present)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {!kind && (
                <p className="text-[13px] font-semibold text-[var(--brand-orange)]">
                  Choose doc type before manual matching.
                </p>
              )}
            </div>
          )}

          {pairingMode === "automatic" && ambiguousCandidates && ambiguousCandidates.length > 1 && (
            <label className={labelCls}>
              <span className="mb-1 block font-bold text-muted-foreground">
                Multiple matches — select event
              </span>
              <select
                value={selectedTestingEventId}
                disabled={disabled || busy}
                onChange={(e) => setSelectedTestingEventId(e.target.value)}
                className={fieldCls}
                aria-label="Select among ambiguous automatic matches"
              >
                <option value="">Select which event…</option>
                {ambiguousCandidates.map((c) => (
                  <option key={c.testingEventId} value={c.testingEventId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {pairingMode === "separate" && similarCandidates && similarCandidates.length > 0 && (
            <label className="flex items-start gap-2 text-[14px] font-semibold text-[var(--brand-slate)]">
              <input
                type="checkbox"
                checked={confirmSeparate}
                disabled={disabled || busy}
                onChange={(e) => setConfirmSeparate(e.target.checked)}
                className="mt-1 accent-[var(--brand-orange)]"
              />
              <span>
                Similar event(s) exist ({similarCandidates.length}). I confirm this is a genuine
                separate test (e.g. another Random).
              </span>
            </label>
          )}

          {conflictMessage && (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-2.5 py-1.5 text-[14px] font-semibold text-danger">
              {conflictMessage}
            </p>
          )}
          {pairingHint && !conflictMessage && (
            <p className="text-[13px] font-semibold text-[var(--brand-slate)]">{pairingHint}</p>
          )}
        </fieldset>
      )}

      <div
        className={
          compact
            ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            : "grid gap-2 sm:grid-cols-2"
        }
      >
        <label className={labelCls}>
          <span className="mb-1 block font-bold text-muted-foreground">Doc type</span>
          <select
            value={kind}
            disabled={disabled || busy}
            onChange={(e) => setKind(parseDrugDocKind(e.target.value) || ("" as const))}
            className={fieldCls}
          >
            <option value="">— (incomplete)</option>
            <option value="federal_drug">{DRUG_DOC_KIND_LABEL.federal_drug}</option>
            <option value="medical_review">{DRUG_DOC_KIND_LABEL.medical_review}</option>
          </select>
        </label>
        <label className={labelCls}>
          <span className="mb-1 block font-bold text-muted-foreground">Collection / event date</span>
          <input
            type="date"
            disabled={disabled || busy}
            value={parseISO(eventDate) ? eventDate : ""}
            onChange={(e) => setEventDate(e.target.value)}
            className={fieldCls}
          />
        </label>
        <label className={labelCls}>
          <span className="mb-1 block font-bold text-muted-foreground">Specimen ID</span>
          <input
            value={specimenId}
            disabled={disabled || busy}
            onChange={(e) => setSpecimenId(e.target.value)}
            placeholder="Leading zeros kept (e.g. 01234)"
            className={`${fieldCls} font-mono`}
          />
        </label>
        <label className={labelCls}>
          <span className="mb-1 block font-bold text-muted-foreground">Reason</span>
          <input
            list="drug-reason-suggestions"
            value={reason}
            disabled={disabled || busy}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Random, Follow-up, …"
            className={fieldCls}
          />
          <datalist id="drug-reason-suggestions">
            {DRUG_REASON_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className={`${labelCls} ${compact ? "lg:col-span-1" : "sm:col-span-2"}`}>
          <span className="mb-1 block font-bold text-muted-foreground">Collection context</span>
          <input
            value={collectionContext}
            disabled={disabled || busy}
            onChange={(e) => setCollectionContext(e.target.value)}
            placeholder="Collection date / site / batch — part of pairing key"
            className={fieldCls}
          />
        </label>
        {!enablePairing && (
          <label className={`${labelCls} ${compact ? "" : "sm:col-span-2"}`}>
            <span className="mb-1 block font-bold text-muted-foreground">Testing event link</span>
            <select
              value={testingEventId}
              disabled={disabled || busy}
              onChange={(e) => setTestingEventId(e.target.value)}
              className={fieldCls}
            >
              <option value="">New testing event (independent)</option>
              {initial?.testingEventId ? (
                <option value={initial.testingEventId}>
                  Keep current · {initial.testingEventId.slice(0, 8)}…
                </option>
              ) : null}
              {linkOptions
                .filter((o) => o.id !== initial?.testingEventId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className={`${labelCls} ${compact ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}`}>
          <span className="mb-1 block font-bold text-muted-foreground">Notes</span>
          <input
            value={notes}
            disabled={disabled || busy}
            onChange={(e) => setNotes(e.target.value)}
            className={fieldCls}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => submit(false)}
          className="rounded-lg bg-brand px-3 py-1.5 text-[14px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {showAddAnother && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => submit(true)}
            className="rounded-lg border border-[color-mix(in_srgb,var(--brand-orange)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand-orange)_10%,white)] px-3 py-1.5 text-[14px] font-bold text-[var(--brand-slate)] disabled:opacity-50"
          >
            Save & Add Another
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-[14px] font-bold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
