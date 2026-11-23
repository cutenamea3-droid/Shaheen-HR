/**
 * Drug Test Records — manual historical event register (NOT document upload / PDF).
 *
 * Short names: Federal Drug (CCF) · Medical Review (MRO).
 * Pairing prefers testingEventId (one individual collection/testing event).
 * Fallback: driver + specimen + controlled reason (dates may be collection vs MRO review).
 * Multi Random / Follow-up stay independent via distinct testingEventId values.
 * Pairing = document verification ONLY — Matched ≠ Negative / clearance / approval.
 * Never auto-clear medical / On-Duty Hours / pass / DOT / Other Docs.
 *
 * Progressive incomplete OK. Soft-delete is recoverable (deletedAt set).
 * Specimen IDs are strings — leading zeros preserved; never Number()-coerced.
 * Duplicates are flagged, never deleted. Manual testingEventId links are preserved.
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

/**
 * UI pair statuses (paperwork only).
 * Keys missing_fd / missing_mr kept for callers; labels are Missing CCF / Missing MRO.
 */
export type DrugPairStatus =
  | "matched"
  | "missing_fd"
  | "missing_mr"
  | "review_needed"
  | "duplicate_review"
  | "specimen_mismatch"
  | "reason_mismatch"
  | "incomplete";

export const DRUG_PAIR_STATUS_LABEL: Record<DrugPairStatus, string> = {
  matched: "Matched",
  missing_fd: "Missing CCF",
  missing_mr: "Missing MRO",
  review_needed: "Review Needed",
  duplicate_review: "Duplicate Review",
  specimen_mismatch: "Review Needed",
  reason_mismatch: "Review Needed",
  incomplete: "Incomplete",
};

/** Primary filter statuses shown in Drug Test Records UI. */
export const DRUG_PAIR_STATUS_PRIMARY: DrugPairStatus[] = [
  "matched",
  "missing_fd",
  "missing_mr",
  "review_needed",
  "duplicate_review",
];

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
   * Collection context (date/site/lab batch text). Part of legacy pairing key.
   * Empty allowed on incomplete records. CCF site ≠ MRO lab is expected.
   */
  collectionContext: string;
  /**
   * Display date. For CCF this is typically collection; for MRO typically review.
   * Different dates across CCF↔MRO are expected and do not block pairing alone.
   */
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
  /** When CCF and MRO dates differ (collection vs review). */
  mroReviewDate?: string;
  /** True when view-model paired across distinct testing_event_id values. */
  logicalPair?: boolean;
  warning?: string;
}

export function newTestingEventId(): string {
  return crypto.randomUUID?.() ?? `te_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/** Corrupt cloud/local may store numbers/null — never assume `.trim()` on raw fields. */
export function asDrugText(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

export function parseDrugDocKind(raw: unknown): DrugDocKind | "" {
  const k = asDrugText(raw).trim().toLowerCase();
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
export function normalizeSpecimenId(s: unknown): string {
  return asDrugText(s).trim().toLowerCase().replace(/[\s\-_.]/g, "");
}

function normKey(s: unknown): string {
  return asDrugText(s).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Controlled reason map — Pre-Employment variants collapse; unknown reasons keep normalized text. */
export function normalizeDrugReason(s: unknown): string {
  const raw = normKey(s);
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "");
  const map: Record<string, string> = {
    preemployment: "pre-employment",
    preemp: "pre-employment",
    random: "random",
    postaccident: "post-accident",
    reasonablesuspicion: "reasonable suspicion",
    returntoduty: "return-to-duty",
    rtd: "return-to-duty",
    followup: "follow-up",
    followups: "follow-up",
  };
  return map[compact] ?? raw;
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

/**
 * CCF date = collection; MRO date = review.
 * Compatible when either blank, equal, or collection ≤ review.
 * Ambiguous when both set and review is strictly before collection.
 */
export type DateRoleCompatibility = "compatible" | "ambiguous" | "equal_or_blank";

export function collectionVsReviewDateCompatibility(
  collectionDate: string,
  reviewDate: string,
): DateRoleCompatibility {
  const c = asDrugText(collectionDate).trim();
  const r = asDrugText(reviewDate).trim();
  if (!c || !r) return "equal_or_blank";
  if (c === r) return "equal_or_blank";
  // ISO yyyy-mm-dd (and similar lexical dates) compare safely as strings.
  if (c <= r) return "compatible";
  return "ambiguous";
}

function statusForLinkedPair(fd: DrugTestEvent, mr: DrugTestEvent): DrugPairStatus {
  const fs = normalizeSpecimenId(fd.specimenId);
  const ms = normalizeSpecimenId(mr.specimenId);
  const fr = normalizeDrugReason(fd.reason);
  const mrR = normalizeDrugReason(mr.reason);
  if (fs && ms && fs !== ms) return "review_needed";
  if (fr && mrR && fr !== mrR) return "review_needed";
  const dateCompat = collectionVsReviewDateCompatibility(fd.eventDate, mr.eventDate);
  if (dateCompat === "ambiguous") return "review_needed";
  if (fs && ms && fr && mrR) return "matched";
  if (fs && ms && fr && mrR) return "matched";
  return "incomplete";
}

type Side = { ev: DrugTestEvent; used: boolean };

function specimenReasonKey(ev: DrugTestEvent): string {
  const s = normalizeSpecimenId(ev.specimenId);
  const r = normalizeDrugReason(ev.reason);
  if (!s || !r) return "";
  return `${s}\t${r}`;
}

/**
 * Pair FD ↔ MR for one driver.
 * Prefer same testingEventId (individual testing event / manual link).
 * Then unique specimen+reason (dates may be collection vs MRO review).
 * Legacy: specimen + reason + collectionContext when ids allow.
 * Soft-deleted rows should be filtered out before calling.
 * Never deletes duplicates — flags Duplicate Review. No cross-driver (caller scopes).
 */
export function pairDrugTestEvents(events: DrugTestEvent[]): DrugPairRow[] {
  const active = (Array.isArray(events) ? events : []).filter((e) => !e.deletedAt);
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
    extra?: Partial<Pick<DrugPairRow, "logicalPair" | "warning" | "mroReviewDate">>,
  ): DrugPairRow => {
    const ccfDate = asDrugText(fd?.eventDate || "").trim();
    const mroDate = asDrugText(mr?.eventDate || "").trim();
    const displayDate = ccfDate || mroDate || asDrugText(fd?.collectionContext || mr?.collectionContext || "").trim();
    const mroReviewDate = ccfDate && mroDate && ccfDate !== mroDate ? mroDate : undefined;
    return {
      id: `pair_${fd?.id ?? "x"}_${mr?.id ?? "x"}`,
      status,
      testingEventId: asDrugText(fd?.testingEventId || mr?.testingEventId || "").trim(),
      federal: fd,
      medical: mr,
      specimenId: asDrugText(fd?.specimenId || mr?.specimenId || "").trim(),
      reason: asDrugText(fd?.reason || mr?.reason || "").trim(),
      collectionContext: asDrugText(fd?.collectionContext || mr?.collectionContext || "").trim(),
      eventDate: displayDate,
      ...(mroReviewDate ? { mroReviewDate } : {}),
      ...extra,
    };
  };

  // Pass 0 — same testingEventId → linked to that individual testing event (manual / attach)
  for (const f of fds) {
    if (f.used) continue;
    const tid = asDrugText(f.ev.testingEventId).trim();
    if (!tid) continue;
    const m = mrs.find((x) => !x.used && asDrugText(x.ev.testingEventId).trim() === tid);
    if (!m) continue;
    f.used = true;
    m.used = true;
    const status = statusForLinkedPair(f.ev, m.ev);
    const dateCompat = collectionVsReviewDateCompatibility(f.ev.eventDate, m.ev.eventDate);
    pairs.push(
      takePair(
        status,
        f.ev,
        m.ev,
        dateCompat === "ambiguous"
          ? {
              warning:
                "MRO review date is before CCF collection date — confirm before treating as one event.",
            }
          : {},
      ),
    );
  }

  /** Classic key pairing only when ids are not both set to different testing events. */
  const classicCompatible = (a: DrugTestEvent, b: DrugTestEvent) => {
    const ta = asDrugText(a.testingEventId).trim();
    const tb = asDrugText(b.testingEventId).trim();
    if (ta && tb && ta !== tb) return false; // independent testing events
    return true;
  };

  // Pass 1 — unique specimen + controlled reason (collection vs review dates OK)
  // Groups leftover sides by driver + specimen+reason; 1:1 → match; N:M / duplicates → flag.
  // Never cross drivers (callers usually pre-scope; still enforce here).
  {
    const unusedFd = fds.filter((x) => !x.used);
    const unusedMr = mrs.filter((x) => !x.used);
    const keys = new Set<string>();
    for (const f of unusedFd) {
      const k = specimenReasonKey(f.ev);
      if (k) keys.add(`${f.ev.driverId}\t${k}`);
    }
    for (const m of unusedMr) {
      const k = specimenReasonKey(m.ev);
      if (k) keys.add(`${m.ev.driverId}\t${k}`);
    }
    for (const fullKey of keys) {
      const tab = fullKey.indexOf("\t");
      const driverId = fullKey.slice(0, tab);
      const key = fullKey.slice(tab + 1);
      const fList = unusedFd.filter(
        (x) => !x.used && x.ev.driverId === driverId && specimenReasonKey(x.ev) === key,
      );
      const mList = unusedMr.filter(
        (x) => !x.used && x.ev.driverId === driverId && specimenReasonKey(x.ev) === key,
      );
      if (fList.length === 0 && mList.length === 0) continue;

      // Duplicates on either side with no unique 1:1 — flag, do not delete / force-merge
      if (fList.length > 1 || mList.length > 1) {
        for (const f of fList) {
          f.used = true;
          pairs.push(
            takePair("duplicate_review", f.ev, undefined, {
              warning: "Multiple CCF/MRO share this specimen + reason — review; duplicates not deleted.",
            }),
          );
        }
        for (const m of mList) {
          m.used = true;
          pairs.push(
            takePair("duplicate_review", undefined, m.ev, {
              warning: "Multiple CCF/MRO share this specimen + reason — review; duplicates not deleted.",
            }),
          );
        }
        continue;
      }

      if (fList.length === 1 && mList.length === 1) {
        const f = fList[0]!;
        const m = mList[0]!;
        f.used = true;
        m.used = true;
        const dateCompat = collectionVsReviewDateCompatibility(f.ev.eventDate, m.ev.eventDate);
        const sameTe =
          asDrugText(f.ev.testingEventId).trim() &&
          asDrugText(f.ev.testingEventId).trim() === asDrugText(m.ev.testingEventId).trim();
        if (dateCompat === "ambiguous") {
          pairs.push(
            takePair("review_needed", f.ev, m.ev, {
              logicalPair: !sameTe,
              warning:
                "Dates look like MRO review before CCF collection — confirm collection vs review roles before treating as one event.",
            }),
          );
        } else {
          pairs.push(
            takePair(
              "matched",
              f.ev,
              m.ev,
              !sameTe
                ? {
                    logicalPair: true,
                    warning:
                      "Logical pair (same driver + specimen + reason). Collection vs MRO review dates/sites may differ.",
                  }
                : {},
            ),
          );
        }
      }
      // 1:0 or 0:1 fall through to missing passes
    }
  }

  // Pass 2 — exact specimen + reason + collection context → Matched (legacy / ungrouped)
  for (const f of fds) {
    if (f.used) continue;
    const fs = normalizeSpecimenId(f.ev.specimenId);
    const fr = normalizeDrugReason(f.ev.reason);
    const fc = normalizeCollectionContext(f.ev.collectionContext);
    if (!fs || !fr) continue;
    const m = mrs.find(
      (x) =>
        !x.used &&
        classicCompatible(f.ev, x.ev) &&
        normalizeSpecimenId(x.ev.specimenId) === fs &&
        normalizeDrugReason(x.ev.reason) === fr &&
        normalizeCollectionContext(x.ev.collectionContext) === fc,
    );
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(takePair("matched", f.ev, m.ev));
  }

  // Pass 3 — same specimen + same collection context, different reason → Review Needed
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
        normalizeDrugReason(x.ev.reason) !== normalizeDrugReason(f.ev.reason),
    );
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(
      takePair("review_needed", f.ev, m.ev, {
        warning: "Same specimen/site but different reason — review needed.",
      }),
    );
  }

  // Pass 4 — same reason + same collection context, different specimen → Review Needed
  for (const f of fds) {
    if (f.used) continue;
    const fr = normalizeDrugReason(f.ev.reason);
    const fc = normalizeCollectionContext(f.ev.collectionContext);
    const fs = normalizeSpecimenId(f.ev.specimenId);
    if (!fr) continue;
    const m = mrs.find((x) => {
      if (x.used) return false;
      if (!classicCompatible(f.ev, x.ev)) return false;
      if (normalizeDrugReason(x.ev.reason) !== fr) return false;
      if (normalizeCollectionContext(x.ev.collectionContext) !== fc) return false;
      const ms = normalizeSpecimenId(x.ev.specimenId);
      return Boolean(fs && ms && fs !== ms);
    });
    if (!m) continue;
    f.used = true;
    m.used = true;
    pairs.push(
      takePair("review_needed", f.ev, m.ev, {
        warning: "Same reason/site but different specimen — review needed.",
      }),
    );
  }

  // Pass 5 — leftovers (Missing CCF / Missing MRO)
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
    const d = asDrugText(row.eventDate || row.collectionContext || "");
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
  const q = asDrugText(opts.q).trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (status !== "all") {
      // Filter aliases: specimen/reason mismatch count as review_needed
      if (status === "review_needed") {
        if (r.status !== "review_needed" && r.status !== "specimen_mismatch" && r.status !== "reason_mismatch") {
          return false;
        }
      } else if (r.status !== status) {
        return false;
      }
    }
    if (!q) return true;
    const hay = [
      r.specimenId,
      r.reason,
      r.collectionContext,
      r.eventDate,
      r.mroReviewDate,
      r.testingEventId,
      r.federal?.notes,
      r.medical?.notes,
      DRUG_PAIR_STATUS_LABEL[r.status],
      r.federal ? DRUG_DOC_KIND_LABEL.federal_drug : "",
      r.medical ? DRUG_DOC_KIND_LABEL.medical_review : "",
      r.warning,
    ]
      .map((x) => asDrugText(x))
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Build link/unlink targets for staff: opposite incomplete events for same driver
 * that share specimen+reason (or any open opposite when searching).
 */
export function listLinkableOpposites(
  event: DrugTestEvent,
  allForDriver: DrugTestEvent[],
): DrugTestEvent[] {
  if (!event.kind || event.deletedAt) return [];
  const want: DrugDocKind = event.kind === "federal_drug" ? "medical_review" : "federal_drug";
  const myTe = asDrugText(event.testingEventId).trim();
  const myKey = specimenReasonKey(event);
  return (Array.isArray(allForDriver) ? allForDriver : []).filter((e) => {
    if (e.deletedAt || e.id === event.id) return false;
    if (e.kind !== want) return false;
    const te = asDrugText(e.testingEventId).trim();
    // Already linked to this event
    if (myTe && te && myTe === te) return false;
    // Prefer same specimen+reason; if event has no key, list all open opposites
    if (myKey) {
      const otherKey = specimenReasonKey(e);
      if (otherKey && otherKey !== myKey) return false;
    }
    return true;
  });
}
