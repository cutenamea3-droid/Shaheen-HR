/**
 * Smart Hybrid CCF/MRO matching — pure client resolution for Add flows.
 *
 * Matched = same testing-event paperwork (FD↔MR), NOT Negative/Cleared/Approved.
 * Attach uses existing testing_event_id via driver_drug_test_add (no bulk merge).
 * Soft-deleted rows must be filtered out before calling.
 *
 * Collection date (CCF) vs MRO review date may differ — do not require equal dates.
 * Collection site vs lab context may differ. Match on permanent driverId + specimen
 * (string, keep leading zeros) + controlled reason. No cross-driver match.
 */
import {
  DRUG_DOC_KIND_SHORT,
  asDrugText,
  collectionVsReviewDateCompatibility,
  normalizeDrugReason,
  normalizeSpecimenId,
  type DrugDocKind,
  type DrugTestEvent,
} from "./drug-tests";

export type PairingMode = "automatic" | "manual" | "separate";

export type MatchCandidate = {
  testingEventId: string;
  /** Kind already present on the event (opposite of what we're adding). */
  existingKind: DrugDocKind;
  specimenId: string;
  reason: string;
  eventDate: string;
  collectionContext: string;
  /** True when this testing event already has the incoming doc kind (active). */
  hasIncomingKind: boolean;
  label: string;
  /** Date-role ambiguity (review before collection). */
  dateAmbiguous?: boolean;
};

export type IncomingDoc = {
  driverId: string;
  kind: DrugDocKind | "";
  specimenId: string;
  reason: string;
  collectionContext: string;
  eventDate: string;
};

export type PairingResolution =
  | {
      status: "attach";
      testingEventId: string;
      candidate: MatchCandidate;
      message: string;
    }
  | {
      status: "create_new";
      testingEventId: "";
      message: string;
    }
  | {
      status: "ambiguous";
      candidates: MatchCandidate[];
      message: string;
    }
  | {
      status: "conflict";
      candidates: MatchCandidate[];
      message: string;
    }
  | {
      status: "need_manual_pick";
      candidates: MatchCandidate[];
      message: string;
    }
  | {
      status: "need_separate_confirm";
      candidates: MatchCandidate[];
      message: string;
    }
  | {
      status: "blocked";
      message: string;
    };

/**
 * Dates/details for CCF↔MRO auto-pairing.
 *
 * Collection site (CCF) vs lab (MRO) contexts are allowed to differ.
 * Dates: either blank/equal OK; collection ≤ review OK; review-before-collection
 * is still a candidate but marked ambiguous (UI → Review Needed / confirm).
 *
 * Legacy callers that expect strict equality can pass `{ strict: true }`.
 */
export function datesDetailsCompatible(
  a: { eventDate: string; collectionContext: string },
  b: { eventDate: string; collectionContext: string },
  opts?: { strict?: boolean; incomingKind?: DrugDocKind | "" },
): boolean {
  if (opts?.strict) {
    const ad = asDrugText(a.eventDate).trim();
    const bd = asDrugText(b.eventDate).trim();
    if (ad && bd && ad !== bd) return false;
    return true;
  }
  // Non-strict (default): collection vs review / site vs lab differences allowed.
  void a;
  void b;
  void opts;
  return true;
}

/** True when pairing these two dates would be date-role ambiguous. */
export function isDateRoleAmbiguous(
  incoming: IncomingDoc,
  existing: { eventDate: string; existingKind: DrugDocKind },
): boolean {
  if (!incoming.kind) return false;
  const incomingIsCcf = incoming.kind === "federal_drug";
  const collection = incomingIsCcf ? incoming.eventDate : existing.eventDate;
  const review = incomingIsCcf ? existing.eventDate : incoming.eventDate;
  return collectionVsReviewDateCompatibility(collection, review) === "ambiguous";
}

export function oppositeKind(kind: DrugDocKind): DrugDocKind {
  return kind === "federal_drug" ? "medical_review" : "federal_drug";
}

type EventGroup = {
  testingEventId: string;
  driverId: string;
  federal?: DrugTestEvent;
  medical?: DrugTestEvent;
  /** Representative specimen/reason/date from whichever side exists. */
  specimenId: string;
  reason: string;
  eventDate: string;
  collectionContext: string;
};

function groupActiveEvents(events: DrugTestEvent[]): EventGroup[] {
  const list = Array.isArray(events) ? events : [];
  const map = new Map<string, EventGroup>();
  for (const ev of list) {
    if (ev.deletedAt) continue;
    const tid = asDrugText(ev.testingEventId || ev.id || "").trim();
    if (!tid) continue;
    let g = map.get(tid);
    if (!g) {
      g = {
        testingEventId: tid,
        driverId: ev.driverId,
        specimenId: "",
        reason: "",
        eventDate: "",
        collectionContext: "",
      };
      map.set(tid, g);
    }
    if (ev.kind === "federal_drug") g.federal = ev;
    else if (ev.kind === "medical_review") g.medical = ev;
    if (!g.specimenId && ev.specimenId) g.specimenId = ev.specimenId;
    if (!g.reason && ev.reason) g.reason = ev.reason;
    if (!g.eventDate && ev.eventDate) g.eventDate = ev.eventDate;
    if (!g.collectionContext && ev.collectionContext) g.collectionContext = ev.collectionContext;
  }
  return [...map.values()];
}

function candidateFromGroup(
  g: EventGroup,
  incomingKind: DrugDocKind,
  incoming?: IncomingDoc,
): MatchCandidate {
  const existing = incomingKind === "federal_drug" ? g.medical : g.federal;
  const existingKind: DrugDocKind =
    existing?.kind === "federal_drug" || existing?.kind === "medical_review"
      ? existing.kind
      : oppositeKind(incomingKind);
  const hasIncomingKind =
    incomingKind === "federal_drug" ? Boolean(g.federal) : Boolean(g.medical);
  const missing = hasIncomingKind
    ? "complete"
    : incomingKind === "federal_drug"
      ? "missing CCF"
      : "missing MRO";
  const short = DRUG_DOC_KIND_SHORT[existingKind];
  const dateAmbiguous = incoming
    ? isDateRoleAmbiguous(incoming, { eventDate: g.eventDate, existingKind })
    : false;
  return {
    testingEventId: g.testingEventId,
    existingKind,
    specimenId: g.specimenId,
    reason: g.reason,
    eventDate: g.eventDate,
    collectionContext: g.collectionContext,
    hasIncomingKind,
    dateAmbiguous,
    label: `${short} · ${g.specimenId || "no specimen"} · ${g.reason || "—"} · ${
      g.eventDate || g.collectionContext || "no date"
    } · ${missing}${dateAmbiguous ? " · date review" : ""}`,
  };
}

/** Core key match: same specimen + controlled reason (both required non-empty). */
export function specimenReasonMatch(incoming: IncomingDoc, group: EventGroup): boolean {
  const is = normalizeSpecimenId(incoming.specimenId);
  const gs = normalizeSpecimenId(group.specimenId);
  const ir = normalizeDrugReason(incoming.reason);
  const gr = normalizeDrugReason(group.reason);
  if (!is || !gs || is !== gs) return false;
  if (!ir || !gr || ir !== gr) return false;
  return true;
}

/**
 * Candidates for attaching incoming kind onto an existing testing event that
 * is missing that kind and has compatible specimen/reason/dates.
 */
export function findAttachCandidates(
  incoming: IncomingDoc,
  existingEvents: DrugTestEvent[],
): MatchCandidate[] {
  if (!incoming.kind) return [];
  const kind = incoming.kind;
  const groups = groupActiveEvents(existingEvents).filter((g) => g.driverId === incoming.driverId);
  const out: MatchCandidate[] = [];
  for (const g of groups) {
    const hasIncoming = kind === "federal_drug" ? Boolean(g.federal) : Boolean(g.medical);
    if (hasIncoming) continue;
    // Need the opposite side present (or at least something to attach to)
    const hasOpposite = kind === "federal_drug" ? Boolean(g.medical) : Boolean(g.federal);
    if (!hasOpposite) continue;
    if (!specimenReasonMatch(incoming, g)) continue;
    // Collection vs review dates / site vs lab: allowed (not blocked).
    if (!datesDetailsCompatible(incoming, g, { incomingKind: kind })) continue;
    out.push(candidateFromGroup(g, kind, incoming));
  }
  return out;
}

/** Same specimen+reason but already has incoming kind → conflict (cannot duplicate). */
export function findConflictCandidates(
  incoming: IncomingDoc,
  existingEvents: DrugTestEvent[],
): MatchCandidate[] {
  if (!incoming.kind) return [];
  const kind = incoming.kind;
  const groups = groupActiveEvents(existingEvents).filter((g) => g.driverId === incoming.driverId);
  const out: MatchCandidate[] = [];
  for (const g of groups) {
    const hasIncoming = kind === "federal_drug" ? Boolean(g.federal) : Boolean(g.medical);
    if (!hasIncoming) continue;
    if (!specimenReasonMatch(incoming, g)) continue;
    if (!datesDetailsCompatible(incoming, g, { incomingKind: kind })) continue;
    out.push(candidateFromGroup(g, kind, incoming));
  }
  return out;
}

/**
 * "Similar" for Separate-mode warning: same specimen, or same reason + compatible date.
 * Does not auto-attach — admin may confirm a genuine separate Random/Follow-up.
 */
export function findSimilarEvents(
  incoming: IncomingDoc,
  existingEvents: DrugTestEvent[],
): MatchCandidate[] {
  if (!incoming.kind) return [];
  const kind = incoming.kind;
  const is = normalizeSpecimenId(incoming.specimenId);
  const ir = normalizeDrugReason(incoming.reason);
  const groups = groupActiveEvents(existingEvents).filter((g) => g.driverId === incoming.driverId);
  const out: MatchCandidate[] = [];
  for (const g of groups) {
    const gs = normalizeSpecimenId(g.specimenId);
    const gr = normalizeDrugReason(g.reason);
    const sameSpecimen = Boolean(is && gs && is === gs);
    const sameReason =
      Boolean(ir && gr && ir === gr) && datesDetailsCompatible(incoming, g, { incomingKind: kind });
    if (!sameSpecimen && !sameReason) continue;
    out.push(candidateFromGroup(g, kind, incoming));
  }
  return out;
}

/** All incomplete / open events for a driver usable in Manual Matching picker. */
export function listManualMatchOptions(
  driverId: string,
  incomingKind: DrugDocKind | "",
  existingEvents: DrugTestEvent[],
): MatchCandidate[] {
  if (!incomingKind) return [];
  const groups = groupActiveEvents(existingEvents).filter((g) => g.driverId === driverId);
  return groups.map((g) => candidateFromGroup(g, incomingKind));
}

export function validateManualAttach(
  incoming: IncomingDoc,
  testingEventId: string,
  existingEvents: DrugTestEvent[],
): PairingResolution {
  const tid = asDrugText(testingEventId).trim();
  if (!tid) {
    return { status: "blocked", message: "Select an existing testing event to match." };
  }
  if (!incoming.kind) {
    return { status: "blocked", message: "Choose Federal Drug (CCF) or Medical Review (MRO) first." };
  }
  const groups = groupActiveEvents(existingEvents).filter((g) => g.driverId === incoming.driverId);
  const g = groups.find((x) => x.testingEventId === tid);
  if (!g) {
    return { status: "blocked", message: "Selected testing event was not found for this driver." };
  }
  const cand = candidateFromGroup(g, incoming.kind);
  if (cand.hasIncomingKind) {
    return {
      status: "blocked",
      message: `This testing event already has an active ${
        incoming.kind === "federal_drug" ? "Federal Drug (CCF)" : "Medical Review (MRO)"
      }. Soft-delete it first or use New Separate Test.`,
    };
  }
  // Warn (do not silent overwrite) when specimen/reason disagree — still allow after explicit pick
  // but require at least one side present on the event.
  const hasOpposite =
    incoming.kind === "federal_drug" ? Boolean(g.medical) : Boolean(g.federal);
  if (!hasOpposite && !g.federal && !g.medical) {
    return { status: "blocked", message: "Cannot attach to an empty testing event group." };
  }
  return {
    status: "attach",
    testingEventId: tid,
    candidate: cand,
    message: `Manually matched to existing event (${asDrugText(cand.label)}).`,
  };
}

/**
 * Resolve how an Add should pair given mode + optional UI choices.
 * Never invents clearance; never bulk-merges historical rows.
 */
export function resolvePairing(opts: {
  mode: PairingMode;
  incoming: IncomingDoc;
  existingEvents: DrugTestEvent[];
  /** Manual mode: user-selected testing_event_id. */
  manualTestingEventId?: string | undefined;
  /** Automatic: user chose among ambiguous candidates. */
  selectedTestingEventId?: string | undefined;
  /** Separate: admin confirmed create despite similar events. */
  confirmSeparate?: boolean | undefined;
}): PairingResolution {
  const { mode, incoming, existingEvents } = opts;

  if (mode === "manual") {
    return validateManualAttach(incoming, opts.manualTestingEventId ?? "", existingEvents);
  }

  if (mode === "separate") {
    const similar = findSimilarEvents(incoming, existingEvents);
    if (similar.length && !opts.confirmSeparate) {
      return {
        status: "need_separate_confirm",
        candidates: similar,
        message:
          "Similar testing event(s) already exist for this driver. Confirm to create a genuine separate test (e.g. another Random).",
      };
    }
    return {
      status: "create_new",
      testingEventId: "",
      message: similar.length
        ? "Creating a new separate testing event (admin confirmed)."
        : "Creating a new separate testing event.",
    };
  }

  // Automatic (default)
  if (!incoming.kind) {
    return {
      status: "create_new",
      testingEventId: "",
      message: "Incomplete doc type — creating a new testing event.",
    };
  }

  const conflicts = findConflictCandidates(incoming, existingEvents);
  if (conflicts.length) {
    return {
      status: "conflict",
      candidates: conflicts,
      message:
        "A matching testing event already has this document type. Use Manual Matching after soft-delete, or New Separate Test for a different event.",
    };
  }

  const candidates = findAttachCandidates(incoming, existingEvents);

  if (candidates.length === 1) {
    const c = candidates[0]!;
    // Date-role ambiguous (review before collection): do not silent-auto-attach
    if (c.dateAmbiguous && !asDrugText(opts.selectedTestingEventId).trim()) {
      return {
        status: "ambiguous",
        candidates: [c],
        message:
          "Possible match found, but dates look like MRO review before CCF collection — confirm to link, or use Manual / Separate.",
      };
    }
    const selected = asDrugText(opts.selectedTestingEventId).trim();
    if (c.dateAmbiguous && selected && selected !== c.testingEventId) {
      return {
        status: "ambiguous",
        candidates: [c],
        message:
          "Possible match found, but dates look like MRO review before CCF collection — confirm to link, or use Manual / Separate.",
      };
    }
    return {
      status: "attach",
      testingEventId: c.testingEventId,
      candidate: c,
      message: c.dateAmbiguous
        ? `Linked after date-role confirm (${asDrugText(c.label)}).`
        : `Automatically matched to existing event (${asDrugText(c.label)}).`,
    };
  }

  if (candidates.length > 1) {
    const selected = asDrugText(opts.selectedTestingEventId).trim();
    if (selected && candidates.some((c) => c.testingEventId === selected)) {
      const c = candidates.find((x) => x.testingEventId === selected)!;
      return {
        status: "attach",
        testingEventId: c.testingEventId,
        candidate: c,
        message: `Matched to selected event (${asDrugText(c.label)}).`,
      };
    }
    return {
      status: "ambiguous",
      candidates,
      message: "Multiple matching events found — select which testing event to attach to (no multi-match).",
    };
  }

  return {
    status: "create_new",
    testingEventId: "",
    message: "No compatible open event — creating a new testing event.",
  };
}
