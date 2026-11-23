/**
 * CCF/MRO deterministic pairing — Habibi regression + status rules.
 * View-model only; no Prod SQL / no destructive merges.
 */
import { describe, expect, it } from "vitest";
import {
  datesDetailsCompatible,
  findAttachCandidates,
  resolvePairing,
} from "@/lib/driver-hr/drug-test-matching";
import {
  DRUG_PAIR_STATUS_LABEL,
  collectionVsReviewDateCompatibility,
  normalizeDrugReason,
  normalizeSpecimenId,
  pairDrugTestEvents,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";

function ev(partial: Partial<DrugTestEvent> & Pick<DrugTestEvent, "id" | "kind">): DrugTestEvent {
  return {
    driverId: "d_47p5lreqwq89",
    testingEventId: "te-1",
    specimenId: "",
    reason: "",
    collectionContext: "",
    eventDate: "",
    notes: "",
    createdAt: 1,
    ...partial,
  };
}

/** Prod Habibi snapshot (read-only verify) — distinct testing_event_ids, dates, sites. */
const habibiCcf = ev({
  id: "ab3fa384-8821-4e4f-bf3d-5be59db14992",
  kind: "federal_drug",
  testingEventId: "1a20b0a8-2e68-410e-9247-e73e142a8ad4",
  specimenId: "0747330",
  reason: "Pre-Employment",
  collectionContext: "Sutter Lab Inc",
  eventDate: "2026-11-14",
  createdAt: 2,
});

const habibiMro = ev({
  id: "96f71161-a16d-431d-8b0b-9fa67f777aa6",
  kind: "medical_review",
  testingEventId: "ba72a5d4-0b1d-43dd-a6c9-add58dec2bfe",
  specimenId: "0747330",
  reason: "Pre-Employment",
  collectionContext: "Quest Diagnostics-Lenexa 10101 Renner Blvd Lenexa, KS 66219",
  eventDate: "2026-11-17",
  createdAt: 1,
});

describe("CCF/MRO pairing — Habibi + rules", () => {
  it("Habibi 0747330 Pre-Employment → one Matched logical row (collection vs MRO review)", () => {
    const rows = pairDrugTestEvents([habibiCcf, habibiMro]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("matched");
    expect(rows[0]!.specimenId).toBe("0747330");
    expect(normalizeSpecimenId(rows[0]!.specimenId)).toBe("0747330");
    expect(rows[0]!.eventDate).toBe("2026-11-14");
    expect(rows[0]!.mroReviewDate).toBe("2026-11-17");
    expect(rows[0]!.logicalPair).toBe(true);
    expect(rows[0]!.federal?.id).toBe(habibiCcf.id);
    expect(rows[0]!.medical?.id).toBe(habibiMro.id);
    expect(DRUG_PAIR_STATUS_LABEL.matched).toBe("Matched");
  });

  it("Automatic attach: Habibi-style date/site differences still attach uniquely", () => {
    const r = resolvePairing({
      mode: "automatic",
      incoming: {
        driverId: habibiCcf.driverId,
        kind: "medical_review",
        specimenId: "0747330",
        reason: "Pre-Employment",
        collectionContext: habibiMro.collectionContext,
        eventDate: "2026-11-17",
      },
      existingEvents: [habibiCcf],
    });
    expect(r.status).toBe("attach");
    if (r.status === "attach") expect(r.testingEventId).toBe(habibiCcf.testingEventId);
    expect(findAttachCandidates(
      {
        driverId: habibiCcf.driverId,
        kind: "medical_review",
        specimenId: "0747330",
        reason: "Pre-Employment",
        collectionContext: habibiMro.collectionContext,
        eventDate: "2026-11-17",
      },
      [habibiCcf],
    )).toHaveLength(1);
  });

  it("specimen keeps leading zeros; reason map collapses Pre-Employment variants", () => {
    expect(normalizeSpecimenId("0747330")).toBe("0747330");
    expect(normalizeSpecimenId("0747330")).not.toBe("747330");
    expect(normalizeDrugReason("pre employment")).toBe("pre-employment");
    expect(normalizeDrugReason("Pre-Employment")).toBe("pre-employment");
  });

  it("collection ≤ review → compatible; review before collection → ambiguous / Review Needed", () => {
    expect(collectionVsReviewDateCompatibility("2026-11-14", "2026-11-17")).toBe("compatible");
    expect(collectionVsReviewDateCompatibility("2026-11-17", "2026-11-14")).toBe("ambiguous");
    expect(datesDetailsCompatible(
      { eventDate: "2026-11-14", collectionContext: "Site A" },
      { eventDate: "2026-11-17", collectionContext: "Lab B" },
    )).toBe(true);

    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-a",
        specimenId: "111",
        reason: "Random",
        eventDate: "2026-11-20",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: "te-b",
        specimenId: "111",
        reason: "Random",
        eventDate: "2026-11-10",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("review_needed");
    expect(DRUG_PAIR_STATUS_LABEL.review_needed).toBe("Review Needed");
  });

  it("duplicates flagged Duplicate Review — not deleted; multiple tests per driver OK", () => {
    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-1",
        specimenId: "9",
        reason: "Random",
        eventDate: "2026-01-01",
      }),
      ev({
        id: "f2",
        kind: "federal_drug",
        testingEventId: "te-2",
        specimenId: "9",
        reason: "Random",
        eventDate: "2026-01-02",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: "te-3",
        specimenId: "9",
        reason: "Random",
        eventDate: "2026-01-03",
      }),
    ]);
    expect(rows.every((r) => r.status === "duplicate_review")).toBe(true);
    expect(rows).toHaveLength(3);
    expect(DRUG_PAIR_STATUS_LABEL.duplicate_review).toBe("Duplicate Review");
  });

  it("no cross-driver match; Missing CCF / Missing MRO labels", () => {
    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        driverId: "dA",
        kind: "federal_drug",
        testingEventId: "te-a",
        specimenId: "55",
        reason: "Random",
      }),
      ev({
        id: "m1",
        driverId: "dB",
        kind: "medical_review",
        testingEventId: "te-b",
        specimenId: "55",
        reason: "Random",
      }),
    ]);
    // pairDrugTestEvents is per-driver scoped by callers; mixed driverId in one call
    // still will not join across testing ids without same-driver grouping — treat as leftovers.
    expect(rows.some((r) => r.status === "missing_mr")).toBe(true);
    expect(rows.some((r) => r.status === "missing_fd")).toBe(true);
    expect(DRUG_PAIR_STATUS_LABEL.missing_fd).toBe("Missing CCF");
    expect(DRUG_PAIR_STATUS_LABEL.missing_mr).toBe("Missing MRO");
  });

  it("manual testingEventId association preserved as Matched (same te)", () => {
    const te = "shared-manual-te";
    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: te,
        specimenId: "1",
        reason: "Follow-up",
        eventDate: "2026-02-01",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: te,
        specimenId: "1",
        reason: "Follow-up",
        eventDate: "2026-02-05",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("matched");
    expect(rows[0]!.logicalPair).toBeFalsy();
  });

  it("auto: no multi-match when two open CCFs share specimen+reason", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-a",
        specimenId: "0747330",
        reason: "Pre-Employment",
        eventDate: "2026-11-14",
      }),
      ev({
        id: "f2",
        kind: "federal_drug",
        testingEventId: "te-b",
        specimenId: "0747330",
        reason: "Pre-Employment",
        eventDate: "2026-11-15",
      }),
    ];
    const r = resolvePairing({
      mode: "automatic",
      incoming: {
        driverId: "d_47p5lreqwq89",
        kind: "medical_review",
        specimenId: "0747330",
        reason: "Pre-Employment",
        collectionContext: "",
        eventDate: "2026-11-17",
      },
      existingEvents: existing,
    });
    expect(r.status).toBe("ambiguous");
  });

  it("backup-shaped events reconstruct the same Habibi logical pair", () => {
    // Complete Backup stores raw events; pairing is deterministic view-model.
    const fromBackup = [habibiCcf, habibiMro].map((e) => ({ ...e }));
    const a = pairDrugTestEvents(fromBackup);
    const b = pairDrugTestEvents(fromBackup);
    expect(a).toEqual(b);
    expect(a[0]!.status).toBe("matched");
  });
});
