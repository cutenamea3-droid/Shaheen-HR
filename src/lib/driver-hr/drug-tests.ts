/**
 * Drug Test Records — manual historical event register (NOT document upload / PDF).
 *
 * Short names: Federal Drug (CCF) · Medical Review (MRO).
 * Pairing prefers testingEventId (one individual collection/testing event).
 * Fallback key (legacy / ungrouped): driverId + specimenId + reason + collectionContext.
 * Multi Random / Follow-up stay independent via distinct testingEventId values.
 * Pairing = document verification ONLY — Matched ≠ Negative / clearance / approval.
 * Never auto-clear medical / On-Duty Hours / pass / DOT / Other Docs.
 *
 * Progressive incomplete OK. Soft-delete is recoverable (deletedAt set).
 * Specimen IDs are strings — leading zeros preserved; never Number()-coerced.
 */

export type DrugDocKind = "federal_drug" | "medical_review";

/** UI short names. */
export const DRUG_DOC_KIND_LABEL: Record<DrugDocKind, string> = {
  federal_drug: "Federal Drug (CCF)",
  medical_review: "Medical Review (MRO)",
};

export const DRUG_DOC_KIND_SHORT: Record<DrugDocKind, string> = {
  federal_drug: "FD",
  medical_review: "MR",
};

export const DRUG_REASON_SUGGESTIONS = [
  "Pre-Employment",
  "Random",
  "Post-Accident",
  "Reasonable Suspicion",
  "Return-to-Duty",
  "Follow-up",
] as const;

export type DrugPairStatus =
  | "matched"
  | "missing_fd"
  | "missing_mr"
  | "specimen_mismatch"
  | "reason_mismatch"
  | "incomplete";

export const DRUG_PAIR_STATUS_LABEL: Record<DrugPairStatus, string> = {
  matched: "Matched",
  missing_fd: "Missing FD",
  missing_mr: "Missing MR",
  specimen_mismatch: "Specimen Mismatch",
  reason_mismatch: "Reason Mismatch",
  incomplete: "Incomplete",
};

export interface DrugTestEvent {
  id: string;
  driverId: string;
  /**
   * Groups FD + MR for one individual testing/collection event.
   * Distinct ids keep separate Random / Follow-up events independent.
   */
  testingEventId: string;
  /** Empty allowed while progressive entry. */
  kind: DrugDocKind | "";
  /** String — preserve leading zeros (e.g. "01234"). Never coerce to number. */
  specimenId: string;
  reason: string;
  /**
   * Collection context (date/site/lab batch text). Part of fallback pairing key.
   * Empty allowed on incomplete records.
   */
  collectionContext: string;
  /** Optional display date; not a substitute for collectionContext. */
  eventDate: string;
  notes: string;
  createdAt: number;
  /** Soft-delete timestamp (ms). Active rows omit / 0. */
  deletedAt?: number;
}

export interface DrugPairRow {
  id: string;
  status: DrugPairStatus;
  testingEventId: string;
  federal?: DrugTestEvent | undefined;
  medical?: DrugTestEvent | undefined;
  specimenId: string;
  reason: string;
  collectionContext: string;
  eventDate: string;
}

export function newTestingEventId(): string {
  return crypto.randomUUID?.() ?? `te_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function parseDrugDocKind(raw: string | undefined | null): DrugDocKind | "" {
  const k = (raw ?? "").trim().toLowerCase();
  if (!k) return "";
  if (k === "federal_drug" || k === "fd" || k === "ccf" || k.startsWith("federal drug")) return "federal_drug";
  if (k === "medical_review" || k === "mr" || k === "mro" || k.startsWith("medical review")) return "medical_review";
  return "";
}

export function formatDrugDocKind(kind: DrugDocKind | ""): string {
  if (!kind) return "";
  return DRUG_DOC_KIND_LABEL[kind];
}

/** Preserve leading zeros; only trim + casefold + drop cosmetic separators. */
export function normalizeSpecimenId(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\-_.]/g, "");
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeCollectionContext(s: string): string {
  return normKey(s);
}

/** Incomplete when kind missing, or specimen+reason+collectionContext all blank. */
export function isEventIncomplete(ev: DrugTestEvent): boolean {
  if (!ev.kind) return true;
  if (!normalizeSpecimenId(ev.specimenId) && !normKey(ev.reason) && !normalizeCollectionContext(ev.collectionContext)) {
    return true;
  }
  return false;
}

function statusForLinkedPair(fd: DrugTestEvent, mr: DrugTestEvent): DrugPairStatus {
  const fs = normalizeSpecimenId(fd.specimenId);
  const ms = normalizeSpecimenId(mr.specimenId);
  const fr = normKey(fd.reason);
  const mrR = normKey(mr.reason);
  const fc = normalizeCollectionContext(fd.collectionContext);
  const mc = normalizeCollectionContext(mr.collectionContext);
  if (fs && ms && fs !== ms) return "specimen_mismatch";
  if (fr && mrR && fr !== mrR) return "reason_mismatch";
  // Same testing event + same (or one-sided blank) specimen/reason/context → Matched
  if (fs && ms && fr && mrR && fc === mc) return "matched";
  if (fs && ms && fr && mrR) return "matched";
  return "incomplete";
}

type Side = { ev: DrugTestEvent; used: boolean };

/**
 * Pair FD ↔ MR for one driver.
 * Prefer same testingEventId (individual testing event).
 * Fallback: specimen + reason + collectionContext (exact) for ungrouped rows.
 * Soft-deleted rows should be filtered out before calling.
 */
export function pairDrugTestEvents(events: DrugTestEvent[]): DrugPairRow[] {
  const active = events.filter((e) => !e.deletedAt);
  const incomplete: DrugPairRow[] = [];
  const fds: Side[] = [];
  const mrs: Side[] = [];

  for (const ev of active) {
    if (isEventIncomplete(ev)) {
      incomplete.push({
        id: `inc_${ev.id}`,
        status: "incomplete",
        testingEventId: ev.testingEventId || "",
        federal: ev.kind === "federal_drug" ? ev : undefined,
        medical: ev.kind === "medical_review" ? ev : undefined,
        specimenId: ev.specimenId,
        reason: ev.reason,
        collectionContext: ev.collectionContext,
        eventDate: ev.eventDate,
      });
      continue;
    }
    if (ev.kind === "federal_drug") fds.push({ ev, used: false });
    else if (ev.kind === "medical_review") mrs.push({ ev, used: false });
  }

  const pairs: DrugPairRow[] = [];

  const takePair = (
    status: DrugPairStatus,
    fd: DrugTestEvent | undefined,
    mr: DrugTestEvent | undefined,
  ): DrugPairRow => ({
    id: `pair_${fd?.id ?? "x"}_${mr?.id ?? "x"}`,
    status,
    testingEventId: (fd?.testingEventId || mr?.testingEventId || "").trim(),
    federal: fd,
    medical: mr,
    specimenId: (fd?.specimenId || mr?.specimenId || "").trim(),
    reason: (fd?.reason || mr?.reason || "").trim(),
    collectionContext: (fd?.collectionContext || mr?.collectionContext || "").trim(),
    eventDate: (fd?.eventDate || mr?.eventDate || "").trim(),
  });

  // Pass 0 — same testingEventId → linked to that individual testing event
  for (const f of fds) {
    if (f.used) continue;
    const tid = (f.ev.testingEventId || "").trim();
    if (!tid) continue;
    const m = mrs.find((x) => !x.used && (x.ev.testingEventId || "").trim() === tid);
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(takePair(statusForLinkedPair(f.ev, m.ev), f.ev, m.ev));
  }

  /** Classic key pairing only when ids are not both set to different testing events. */
  const classicCompatible = (a: DrugTestEvent, b: DrugTestEvent) => {
    const ta = (a.testingEventId || "").trim();
    const tb = (b.testingEventId || "").trim();
    if (ta && tb && ta !== tb) return false; // independent testing events
    return true;
  };

  // Pass 1 — exact specimen + reason + collection context → Matched (legacy / ungrouped)
  for (const f of fds) {
    if (f.used) continue;
    const fs = normalizeSpecimenId(f.ev.specimenId);
    const fr = normKey(f.ev.reason);
    const fc = normalizeCollectionContext(f.ev.collectionContext);
    if (!fs || !fr) continue;
    const m = mrs.find(
      (x) =>
        !x.used &&
        classicCompatible(f.ev, x.ev) &&
        normalizeSpecimenId(x.ev.specimenId) === fs &&
        normKey(x.ev.reason) === fr &&
        normalizeCollectionContext(x.ev.collectionContext) === fc,
    );
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(takePair("matched", f.ev, m.ev));
  }

  // Pass 2 — same specimen + same collection context, different reason → Reason Mismatch
  for (const f of fds) {
    if (f.used) continue;
    const fs = normalizeSpecimenId(f.ev.specimenId);
    const fc = normalizeCollectionContext(f.ev.collectionContext);
    if (!fs) continue;
    const m = mrs.find(
      (x) =>
        !x.used &&
        classicCompatible(f.ev, x.ev) &&
        normalizeSpecimenId(x.ev.specimenId) === fs &&
        normalizeCollectionContext(x.ev.collectionContext) === fc &&
        normKey(x.ev.reason) !== normKey(f.ev.reason),
    );
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(takePair("reason_mismatch", f.ev, m.ev));
  }

  // Pass 3 — same reason + same collection context, different specimen → Specimen Mismatch
  for (const f of fds) {
    if (f.used) continue;
    const fr = normKey(f.ev.reason);
    const fc = normalizeCollectionContext(f.ev.collectionContext);
    const fs = normalizeSpecimenId(f.ev.specimenId);
    if (!fr) continue;
    const m = mrs.find((x) => {
      if (x.used) return false;
      if (!classicCompatible(f.ev, x.ev)) return false;
      if (normKey(x.ev.reason) !== fr) return false;
      if (normalizeCollectionContext(x.ev.collectionContext) !== fc) return false;
      const ms = normalizeSpecimenId(x.ev.specimenId);
      return Boolean(fs && ms && fs !== ms);
    });
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(takePair("specimen_mismatch", f.ev, m.ev));
  }

  // Pass 4 — leftovers
  for (const f of fds) {
    if (f.used) continue;
    f.used = true;
    pairs.push(takePair("missing_mr", f.ev, undefined));
  }
  for (const m of mrs) {
    if (m.used) continue;
    m.used = true;
    pairs.push(takePair("missing_fd", undefined, m.ev));
  }

  const sortKey = (row: DrugPairRow) => {
    const d = row.eventDate || row.collectionContext || "";
    const created = Math.max(row.federal?.createdAt ?? 0, row.medical?.createdAt ?? 0);
    return `${d}\t${created}`;
  };
  const all = [...pairs, ...incomplete];
  all.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return all;
}

export function filterDrugPairs(
  rows: DrugPairRow[],
  opts: { status?: DrugPairStatus | "all"; q?: string } = {},
): DrugPairRow[] {
  const status = opts.status ?? "all";
  const q = (opts.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!q) return true;
    const hay = [
      r.specimenId,
      r.reason,
      r.collectionContext,
      r.eventDate,
      r.testingEventId,
      r.federal?.notes,
      r.medical?.notes,
      DRUG_PAIR_STATUS_LABEL[r.status],
      r.federal ? DRUG_DOC_KIND_LABEL.federal_drug : "",
      r.medical ? DRUG_DOC_KIND_LABEL.medical_review : "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
