/**
 * Smart Hybrid CCF/MRO matching — automated cases 1–14.
 * Live Supabase verification is separate (see docs/drug-test-smart-matching.md).
 */
import { describe, expect, it } from "vitest";
import {
  datesDetailsCompatible,
  findAttachCandidates,
  findConflictCandidates,
  findSimilarEvents,
  listManualMatchOptions,
  resolvePairing,
  validateManualAttach,
} from "@/lib/driver-hr/drug-test-matching";
import {
  normalizeSpecimenId,
  pairDrugTestEvents,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";

function ev(partial: Partial<DrugTestEvent> & Pick<DrugTestEvent, "id" | "kind">): DrugTestEvent {
  return {
    driverId: "d1",
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

const baseIncoming = {
  driverId: "d1",
  kind: "medical_review" as const,
  specimenId: "01234",
  reason: "Random",
  collectionContext: "Lab A",
  eventDate: "2024-01-10",
};

describe("Smart Hybrid CCF/MRO matching (cases 1–14)", () => {
  it("1. Automatic: exactly one open CCF → attaching MRO uses that testing_event_id", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-open",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    const r = resolvePairing({
      mode: "automatic",
      incoming: baseIncoming,
      existingEvents: existing,
    });
    expect(r.status).toBe("attach");
    if (r.status === "attach") expect(r.testingEventId).toBe("te-open");
  });

  it("2. Automatic: exactly one open MRO → attaching CCF uses that testing_event_id", () => {
    const existing = [
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: "te-mro",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    const r = resolvePairing({
      mode: "automatic",
      incoming: { ...baseIncoming, kind: "federal_drug" },
      existingEvents: existing,
    });
    expect(r.status).toBe("attach");
    if (r.status === "attach") expect(r.testingEventId).toBe("te-mro");
  });

  it("3. Specimen normalize: trim whitespace; keep letters and leading zeros", () => {
    expect(normalizeSpecimenId("  01234  ")).toBe("01234");
    expect(normalizeSpecimenId("AB-01234")).toBe("ab01234");
    expect(normalizeSpecimenId("01234")).not.toBe("1234");
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-z",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    const r = resolvePairing({
      mode: "automatic",
      incoming: { ...baseIncoming, specimenId: "  01234  " },
      existingEvents: existing,
    });
    expect(r.status).toBe("attach");
  });

  it("4. Automatic: no candidate → create_new (no duplicate attach)", () => {
    const r = resolvePairing({
      mode: "automatic",
      incoming: baseIncoming,
      existingEvents: [],
    });
    expect(r.status).toBe("create_new");
  });

  it("5. Automatic: two compatible open events → ambiguous (prompt select)", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-a",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
      ev({
        id: "f2",
        kind: "federal_drug",
        testingEventId: "te-b",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    const r = resolvePairing({
      mode: "automatic",
      incoming: baseIncoming,
      existingEvents: existing,
    });
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") expect(r.candidates).toHaveLength(2);

    const picked = resolvePairing({
      mode: "automatic",
      incoming: baseIncoming,
      existingEvents: existing,
      selectedTestingEventId: "te-b",
    });
    expect(picked.status).toBe("attach");
    if (picked.status === "attach") expect(picked.testingEventId).toBe("te-b");
  });

  it("6. Automatic: conflict when matching event already has that doc type", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-full",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: "te-full",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    const r = resolvePairing({
      mode: "automatic",
      incoming: baseIncoming,
      existingEvents: existing,
    });
    expect(r.status).toBe("conflict");
    expect(findConflictCandidates(baseIncoming, existing).length).toBeGreaterThan(0);
  });

  it("7. Manual: attach to selected event missing opposite doc", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-man",
        specimenId: "999",
        reason: "Follow-up",
        collectionContext: "Site",
        eventDate: "2024-02-01",
      }),
    ];
    const r = validateManualAttach(
      {
        driverId: "d1",
        kind: "medical_review",
        specimenId: "999",
        reason: "Follow-up",
        collectionContext: "Site",
        eventDate: "2024-02-01",
      },
      "te-man",
      existing,
    );
    expect(r.status).toBe("attach");
    if (r.status === "attach") expect(r.testingEventId).toBe("te-man");
  });

  it("8. Manual: block duplicate active CCF/MRO (never silent overwrite)", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-dup",
        specimenId: "1",
        reason: "Random",
        eventDate: "2024-01-01",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: "te-dup",
        specimenId: "1",
        reason: "Random",
        eventDate: "2024-01-01",
      }),
    ];
    const r = validateManualAttach(
      { ...baseIncoming, specimenId: "1", kind: "federal_drug" },
      "te-dup",
      existing,
    );
    expect(r.status).toBe("blocked");
    expect(r.message).toMatch(/already has an active/i);
  });

  it("9. Manual picker lists specimen/reason/date/missing doc; empty pick blocked", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-list",
        specimenId: "555",
        reason: "Pre-Employment",
        eventDate: "2024-03-01",
        collectionContext: "HQ",
      }),
    ];
    const opts = listManualMatchOptions("d1", "medical_review", existing);
    expect(opts).toHaveLength(1);
    expect(opts[0]!.label).toMatch(/555/);
    expect(opts[0]!.label).toMatch(/Pre-Employment/);
    expect(opts[0]!.label).toMatch(/missing MRO/i);
    const empty = validateManualAttach(baseIncoming, "", existing);
    expect(empty.status).toBe("blocked");
  });

  it("10. New Separate: always create_new; warn when similar exists until confirm", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-sim",
        specimenId: "01234",
        reason: "Random",
        eventDate: "2024-01-10",
        collectionContext: "Lab A",
      }),
    ];
    const warn = resolvePairing({
      mode: "separate",
      incoming: baseIncoming,
      existingEvents: existing,
    });
    expect(warn.status).toBe("need_separate_confirm");
    expect(findSimilarEvents(baseIncoming, existing).length).toBeGreaterThan(0);

    const ok = resolvePairing({
      mode: "separate",
      incoming: baseIncoming,
      existingEvents: existing,
      confirmSeparate: true,
    });
    expect(ok.status).toBe("create_new");
  });

  it("11. Compatible dates/details: blank OK; both set must agree", () => {
    expect(
      datesDetailsCompatible(
        { eventDate: "2024-01-10", collectionContext: "" },
        { eventDate: "", collectionContext: "Lab A" },
      ),
    ).toBe(true);
    expect(
      datesDetailsCompatible(
        { eventDate: "2024-01-10", collectionContext: "Lab A" },
        { eventDate: "2024-01-11", collectionContext: "Lab A" },
      ),
    ).toBe(false);
  });

  it("12. Soft-deleted opposite does not count as attach candidate", () => {
    const existing = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-del",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
        deletedAt: Date.now(),
      }),
    ];
    expect(findAttachCandidates(baseIncoming, existing)).toHaveLength(0);
    const r = resolvePairing({
      mode: "automatic",
      incoming: baseIncoming,
      existingEvents: existing,
    });
    expect(r.status).toBe("create_new");
  });

  it("13. Auto-match then pairDrugTestEvents → Matched paperwork (≠ clearance)", () => {
    const te = "te-pair";
    const afterAttach = [
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: te,
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: te,
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    const rows = pairDrugTestEvents(afterAttach);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("matched");
    // Semantic: Matched is paperwork only — label is not clearance language
    expect(rows[0]!.status).not.toBe("incomplete");
  });

  it("14. Read-only incomplete events stay independent — no bulk auto-merge across ids", () => {
    const existing = [
      ev({
        id: "inc1",
        kind: "",
        testingEventId: "te-inc-1",
        specimenId: "",
        reason: "",
      }),
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: "te-inc-2",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
    ];
    // Incomplete blank kind is not an attach target; only the open CCF is
    const candidates = findAttachCandidates(baseIncoming, existing);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.testingEventId).toBe("te-inc-2");
    // Display pairing still shows incomplete separately
    const rows = pairDrugTestEvents(existing);
    expect(rows.some((r) => r.status === "incomplete")).toBe(true);
    expect(rows.some((r) => r.status === "missing_mr")).toBe(true);
  });
});
