/**
 * Tests 1–10 for Rate Card · Date of Hire · Drug Test Records.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { normalizeRateInput, emptyRateCard, rateCardHasContent } from "@/lib/driver-hr/rate-card-types";
import { useRateCardMock } from "@/lib/driver-hr/rate-card-mock";
import {
  formatHireDateDisplay,
  lengthOfService,
  parseHireDateInput,
  applyDateOfHire,
  dateOfHireOf,
} from "@/lib/driver-hr/hire-date";
import {
  isEventIncomplete,
  normalizeSpecimenId,
  pairDrugTestEvents,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";
import { useDrugTestMock } from "@/lib/driver-hr/drug-test-mock";
import { clearSensitiveAudit, listSensitiveAudit } from "@/lib/driver-hr/sensitive-audit";
import { buildSeed } from "@/lib/sections";

function ev(partial: Partial<DrugTestEvent> & Pick<DrugTestEvent, "id" | "kind">): DrugTestEvent {
  return {
    driverId: "d1",
    testingEventId: "",
    specimenId: "",
    reason: "",
    collectionContext: "",
    eventDate: "",
    notes: "",
    createdAt: 1,
    ...partial,
  };
}

describe("Driver rate / hire / drug tests (1–10)", () => {
  beforeEach(() => {
    useRateCardMock.getState().clearAll();
    useDrugTestMock.getState().clearAll();
    clearSensitiveAudit();
  });

  it("1. Rate precision 0.550 preserved; blank ≠ 0; empty card invents nothing", () => {
    expect(normalizeRateInput("0.550")).toBe("0.550");
    expect(normalizeRateInput("")).toBe("");
    expect(normalizeRateInput("abc")).toBeNull();
    const card = useRateCardMock.getState().get("d_new");
    expect(card.rates).toEqual({});
    expect(rateCardHasContent(emptyRateCard("x"))).toBe(false);
    const set = useRateCardMock.getState().setRate("d1", "percentage", "0.550");
    expect(set.ok && set.card.rates.percentage).toBe("0.550");
    const cleared = useRateCardMock.getState().setRate("d1", "percentage", "");
    expect(cleared.ok && cleared.card.rates.percentage).toBeUndefined();
    const zero = useRateCardMock.getState().setRate("d1", "loadedCpm", "0");
    expect(zero.ok && zero.card.rates.loadedCpm).toBe("0");
  });

  it("2. Rate card allows empty/partial Pay Method save without inventing rates", () => {
    const card = useRateCardMock.getState().setPayMethod("d1", "");
    expect(card.payMethod).toBe("");
    expect(rateCardHasContent(card)).toBe(false);
    const partial = useRateCardMock.getState().setPayMethod("d1", "percentage", "optional note");
    expect(partial.payMethod).toBe("percentage");
    expect(Object.keys(partial.rates)).toHaveLength(0);
  });

  it("3. Date of Hire parses MM/DD/YYYY + ISO, clearable, no invent", () => {
    expect(parseHireDateInput("03/15/2024")).toBe("2024-03-15");
    expect(parseHireDateInput("3/5/2024")).toBe("2024-03-05");
    expect(parseHireDateInput("2024-03-15")).toBe("2024-03-15");
    expect(parseHireDateInput("")).toBe("");
    expect(parseHireDateInput("nope")).toBeNull();
    expect(formatHireDateDisplay("2024-03-15")).toBe("03/15/2024");
    expect(lengthOfService("")).toBeNull();
  });

  it("4. Date of Hire mirrors all classifications without inventing for others", () => {
    const seed = buildSeed();
    const anyRow = seed.sections.dmv?.rows[0];
    if (!anyRow) return;
    const id = anyRow.driverId;
    expect(dateOfHireOf(seed, id)).toBe("");
    const next = applyDateOfHire(seed, id, "2023-06-01");
    expect(dateOfHireOf(next, id)).toBe("2023-06-01");
    const other = seed.sections.dmv?.rows.find((r) => r.driverId !== id);
    if (other) expect(dateOfHireOf(next, other.driverId)).toBe("");
  });

  it("5. Drug pairing: exact driver+specimen+reason+collection → Matched (≠ clearance)", () => {
    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Site A 2024-01-10",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Site A 2024-01-10",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("matched");
  });

  it("6. Missing FD / Missing MR for partial pairs", () => {
    const onlyFd = pairDrugTestEvents([
      ev({ id: "f1", kind: "federal_drug", specimenId: "X", reason: "Random", collectionContext: "C1" }),
    ]);
    expect(onlyFd[0]!.status).toBe("missing_mr");
    const onlyMr = pairDrugTestEvents([
      ev({ id: "m1", kind: "medical_review", specimenId: "X", reason: "Random", collectionContext: "C1" }),
    ]);
    expect(onlyMr[0]!.status).toBe("missing_fd");
  });

  it("7. Specimen Mismatch and Reason Mismatch", () => {
    const reason = pairDrugTestEvents([
      ev({ id: "f1", kind: "federal_drug", specimenId: "S1", reason: "Random", collectionContext: "C" }),
      ev({
        id: "m1",
        kind: "medical_review",
        specimenId: "S1",
        reason: "Follow-up",
        collectionContext: "C",
      }),
    ]);
    expect(reason[0]!.status).toBe("reason_mismatch");
    const specimen = pairDrugTestEvents([
      ev({ id: "f1", kind: "federal_drug", specimenId: "AAA", reason: "Random", collectionContext: "C" }),
      ev({
        id: "m1",
        kind: "medical_review",
        specimenId: "BBB",
        reason: "Random",
        collectionContext: "C",
      }),
    ]);
    expect(specimen[0]!.status).toBe("specimen_mismatch");
  });

  it("8. Leading zeros preserved; 01234 ≠ 1234; multi Random/Follow-up 1:1", () => {
    expect(normalizeSpecimenId("01234")).toBe("01234");
    expect(normalizeSpecimenId("01234")).not.toBe(normalizeSpecimenId("1234"));
    const rows = pairDrugTestEvents([
      ev({ id: "f1", kind: "federal_drug", specimenId: "A1", reason: "Random", collectionContext: "C1" }),
      ev({ id: "f2", kind: "federal_drug", specimenId: "A2", reason: "Follow-up", collectionContext: "C2" }),
      ev({
        id: "m1",
        kind: "medical_review",
        specimenId: "A1",
        reason: "Random",
        collectionContext: "C1",
      }),
      ev({
        id: "m2",
        kind: "medical_review",
        specimenId: "A2",
        reason: "Follow-up",
        collectionContext: "C2",
      }),
    ]);
    expect(rows.filter((r) => r.status === "matched")).toHaveLength(2);
  });

  it("9. Progressive Incomplete OK; pairing never mutates events; no overwrite on add", () => {
    expect(isEventIncomplete(ev({ id: "x", kind: "" }))).toBe(true);
    expect(isEventIncomplete(ev({ id: "x", kind: "federal_drug" }))).toBe(true);
    const f = ev({ id: "f1", kind: "federal_drug", specimenId: "Z", reason: "Random", collectionContext: "C" });
    const snap = structuredClone(f);
    pairDrugTestEvents([f]);
    expect(f).toEqual(snap);
    const a = useDrugTestMock.getState().add(
      {
        driverId: "d1",
        testingEventId: "",
        kind: "federal_drug",
        specimenId: "1",
        reason: "Random",
        collectionContext: "C",
        eventDate: "",
        notes: "",
      },
      "tester",
    );
    const b = useDrugTestMock.getState().add(
      {
        driverId: "d1",
        testingEventId: "",
        kind: "medical_review",
        specimenId: "1",
        reason: "Random",
        collectionContext: "C",
        eventDate: "",
        notes: "",
      },
      "tester",
    );
    expect(a.id).not.toBe(b.id);
    expect(useDrugTestMock.getState().listForDriver("d1")).toHaveLength(2);
  });

  it("10b. testingEventId links FD/MR; distinct ids keep multi Random independent", () => {
    const te1 = "te-random-1";
    const te2 = "te-follow-2";
    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: te1,
        specimenId: "SAME",
        reason: "Random",
        collectionContext: "C",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: te1,
        specimenId: "SAME",
        reason: "Random",
        collectionContext: "C",
      }),
      ev({
        id: "f2",
        kind: "federal_drug",
        testingEventId: te2,
        specimenId: "SAME",
        reason: "Random",
        collectionContext: "C",
      }),
      ev({
        id: "m2",
        kind: "medical_review",
        testingEventId: te2,
        specimenId: "SAME",
        reason: "Random",
        collectionContext: "C",
      }),
    ]);
    expect(rows.filter((r) => r.status === "matched")).toHaveLength(2);
    expect(rows.find((r) => r.federal?.id === "f1")?.medical?.id).toBe("m1");
    expect(rows.find((r) => r.federal?.id === "f2")?.medical?.id).toBe("m2");
  });

  it("10c. Soft-delete is recoverable; corrections auditable; incomplete editable", () => {
    const draft = useDrugTestMock.getState().add(
      {
        driverId: "d1",
        testingEventId: "",
        kind: "",
        specimenId: "",
        reason: "",
        collectionContext: "",
        eventDate: "",
        notes: "draft",
      },
      "admin",
    );
    expect(isEventIncomplete(draft)).toBe(true);
    const fixed = useDrugTestMock.getState().update(
      draft.id,
      { kind: "federal_drug", specimenId: "01234", reason: "Random", collectionContext: "Site" },
      "admin",
    );
    expect(fixed?.specimenId).toBe("01234");
    expect(listSensitiveAudit().some((a) => a.action === "drug_test_update" && a.detail.includes("correction"))).toBe(
      true,
    );
    expect(useDrugTestMock.getState().remove(draft.id, "admin")).toBe(true);
    expect(useDrugTestMock.getState().listForDriver("d1")).toHaveLength(0);
    expect(useDrugTestMock.getState().restore(draft.id, "admin")?.specimenId).toBe("01234");
    expect(useDrugTestMock.getState().listForDriver("d1")).toHaveLength(1);
    expect(listSensitiveAudit().some((a) => a.action === "drug_test_soft_delete")).toBe(true);
    expect(listSensitiveAudit().some((a) => a.action === "drug_test_restore")).toBe(true);
  });

  it("10. Sensitive audit records drug mutations; mock store not in AppData shape", () => {
    useDrugTestMock.getState().add(
      {
        driverId: "d9",
        testingEventId: "",
        kind: "federal_drug",
        specimenId: "99",
        reason: "Random",
        collectionContext: "Lab",
        eventDate: "",
        notes: "",
      },
      "hr.compliance@gmail.com",
    );
    const audit = listSensitiveAudit();
    expect(audit.some((e) => e.action === "drug_test_add" && e.driverId === "d9")).toBe(true);
    const seed = buildSeed();
    expect(seed.sections.drug_tests).toBeUndefined();
  });
});
