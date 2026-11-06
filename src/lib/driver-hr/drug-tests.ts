/**
 * Drug Test Records — manual historical event register (NOT document upload / PDF).
 *
 * Short names: Federal Drug (CCF) · Medical Review (MRO).
 * Pairing key: driverId + specimenId + reason + collectionContext (exact).
 * Pairing = document verification ONLY — Matched ≠ Negative / clearance / approval.
 * Never auto-clear medical / On-Duty Hours / pass / DOT / Other Docs.
 *
 * Progressive incomplete OK. Multiple Random / Follow-up events allowed (1:1 pairs).
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
  /** Empty allowed while progressive entry. */
  kind: DrugDocKind | "";
  /** String — preserve leading zeros (e.g. "01234"). Never coerce to number. */
  specimenId: string;
  reason: string;
  /**
   * Collection context (date/site/lab batch text). Part of pairing key with
   * driver + specimen + reason. Empty allowed on incomplete records.
   */
  collectionContext: string;
  /** Optional display date; not a substitute for collectionContext. */
  eventDate: string;
  notes: string;
  createdAt: number;
}

export interface DrugPairRow {
  id: string;
  status: DrugPairStatus;
  federal?: DrugTestEvent | undefined;
  medical?: DrugTestEvent | undefined;
  specimenId: string;
  reason: string;
  collectionContext: string;
  eventDate: string;
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

type Side = { ev: DrugTestEvent; used: boolean };

/**
 * Pair FD ↔ MR for one driver.
 * Matched only when specimen + reason + collectionContext all match (and driver).
 * Partial FD or MR alone → Missing MR / Missing FD (if enough fields to classify).
 */
export function pairDrugTestEvents(events: DrugTestEvent[]): DrugPairRow[] {
  const incomplete: DrugPairRow[] = [];
  const fds: Side[] = [];
  const mrs: Side[] = [];

  for (const ev of events) {
    if (isEventIncomplete(ev)) {
      incomplete.push({
        id: `inc_${ev.id}`,
        status: "incomplete",
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
    federal: fd,
    medical: mr,
    specimenId: (fd?.specimenId || mr?.specimenId || "").trim(),
    reason: (fd?.reason || mr?.reason || "").trim(),
    collectionContext: (fd?.collectionContext || mr?.collectionContext || "").trim(),
    eventDate: (fd?.eventDate || mr?.eventDate || "").trim(),
  });

  // Pass 1 — exact specimen + reason + collection context → Matched
  for (const f of fds) {
    if (f.used) continue;
    const fs = normalizeSpecimenId(f.ev.specimenId);
    const fr = normKey(f.ev.reason);
    const fc = normalizeCollectionContext(f.ev.collectionContext);
    if (!fs || !fr) continue; // need specimen+reason for a full match attempt
    const m = mrs.find(
      (x) =>
        !x.used &&
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
