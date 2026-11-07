/**
 * Shared Drug Test event editor (Federal Drug / Medical Review).
 * Records only — no PDF. Matched ≠ clearance.
 */
import { useState } from "react";
import { parseISO } from "@/lib/alerts";
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

export function DrugTestEventEditor({
  initial,
  linkOptions = [],
  disabled = false,
  onSave,
  onCancel,
}: {
  initial?: DrugTestEvent;
  linkOptions?: { id: string; label: string }[];
  disabled?: boolean;
  onSave: (draft: DrugEventDraft) => void | Promise<void>;
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

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Doc type</span>
          <select
            value={kind}
            disabled={disabled || busy}
            onChange={(e) => setKind(parseDrugDocKind(e.target.value) || ("" as const))}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          >
            <option value="">— (incomplete)</option>
            <option value="federal_drug">{DRUG_DOC_KIND_LABEL.federal_drug}</option>
            <option value="medical_review">{DRUG_DOC_KIND_LABEL.medical_review}</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Collection / event date</span>
          <input
            type="date"
            disabled={disabled || busy}
            value={parseISO(eventDate) ? eventDate : ""}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-muted-foreground">Specimen ID</span>
          <input
            value={specimenId}
            disabled={disabled || busy}
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
            disabled={disabled || busy}
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
            disabled={disabled || busy}
            onChange={(e) => setCollectionContext(e.target.value)}
            placeholder="Collection date / site / batch — part of pairing key"
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-bold text-muted-foreground">Testing event link</span>
          <select
            value={testingEventId}
            disabled={disabled || busy}
            onChange={(e) => setTestingEventId(e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          >
            <option value="">New testing event (independent)</option>
            {initial?.testingEventId ? (
              <option value={initial.testingEventId}>Keep current · {initial.testingEventId.slice(0, 8)}…</option>
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
        <label className="block text-xs sm:col-span-2">
          <span className="mb-1 block font-bold text-muted-foreground">Notes</span>
          <input
            value={notes}
            disabled={disabled || busy}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => {
            setBusy(true);
            void Promise.resolve(
              onSave({ kind, specimenId, reason, collectionContext, eventDate, notes, testingEventId }),
            ).finally(() => setBusy(false));
          }}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save event"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-sm font-bold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
