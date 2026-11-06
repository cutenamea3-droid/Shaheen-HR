/**
 * Isolated secure-memory persistence tests (no live Supabase / no prod writes).
 * Proves Rate + Drug save/edit/reload independently and pairing after persistence.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSecureMemory,
  memoryAddDrugTest,
  memoryGetRateCard,
  memoryListDrugTests,
  memorySetPayMethod,
  memorySetRateField,
  memoryUpdateDrugTest,
  restoreSecureMemory,
  snapshotSecureMemory,
} from "@/lib/driver-hr/secure-memory";
import { pairDrugTestEvents } from "@/lib/driver-hr/drug-tests";
import { clearSensitiveAudit, listSensitiveAudit } from "@/lib/driver-hr/sensitive-audit";
import { buildSeed } from "@/lib/sections";
import { dateOfHireOf } from "@/lib/driver-hr/hire-date";

describe("Secure persistence harness (isolated)", () => {
  beforeEach(() => {
    clearSecureMemory();
    clearSensitiveAudit();
  });

  it("rate card save/edit/reload persists decimals and blank≠0 independently of drugs", () => {
    const a = memorySetRateField("d1", "percentage", "0.550", "admin@test");
    expect(a.ok).toBe(true);
    memorySetPayMethod("d1", "percentage", "", "admin@test");
    memorySetRateField("d1", "loadedCpm", "", "admin@test"); // blank clears / never invents 0

    // Simulate reload
    const snap = snapshotSecureMemory();
    clearSecureMemory();
    expect(memoryGetRateCard("d1").rates).toEqual({});
    restoreSecureMemory(snap);

    const card = memoryGetRateCard("d1");
    expect(card.rates.percentage).toBe("0.550");
    expect(card.rates.loadedCpm).toBeUndefined();
    expect(card.payMethod).toBe("percentage");
    // Drug table untouched
    expect(memoryListDrugTests("d1")).toHaveLength(0);
  });

  it("drug events persist independently; pairing + leading zeros + partial after reload", () => {
    memoryAddDrugTest(
      {
        driverId: "d1",
        kind: "federal_drug",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Site A",
        eventDate: "2024-01-10",
        notes: "",
      },
      "admin@test",
    );
    memoryAddDrugTest(
      {
        driverId: "d1",
        kind: "medical_review",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Site A",
        eventDate: "2024-01-10",
        notes: "",
      },
      "admin@test",
    );
    // Partial / incomplete progressive
    const partial = memoryAddDrugTest(
      {
        driverId: "d1",
        kind: "federal_drug",
        specimenId: "",
        reason: "",
        collectionContext: "",
        eventDate: "",
        notes: "draft",
      },
      "admin@test",
    );

    const snap = snapshotSecureMemory();
    clearSecureMemory();
    restoreSecureMemory(snap);

    const rows = memoryListDrugTests("d1");
    expect(rows).toHaveLength(3);
    expect(rows.some((r) => r.specimenId === "01234")).toBe(true);

    const pairs = pairDrugTestEvents(rows);
    expect(pairs.some((p) => p.status === "matched")).toBe(true);
    expect(pairs.some((p) => p.status === "incomplete")).toBe(true);

    // Edit specimen history without overwrite-delete of sibling
    memoryUpdateDrugTest(partial.id, { specimenId: "99", reason: "Follow-up", collectionContext: "Site B" }, "admin@test");
    const after = pairDrugTestEvents(memoryListDrugTests("d1"));
    expect(after.filter((p) => p.status === "matched")).toHaveLength(1);
    expect(after.some((p) => p.status === "missing_mr")).toBe(true);

    // Rate card still empty (independent)
    expect(memoryGetRateCard("d1").rates).toEqual({});
  });

  it("does not write into compliance AppData / invent hire dates", () => {
    memorySetRateField("d9", "percentage", "0.550");
    memoryAddDrugTest({
      driverId: "d9",
      kind: "federal_drug",
      specimenId: "1",
      reason: "Random",
      collectionContext: "C",
      eventDate: "",
      notes: "",
    });
    const seed = buildSeed();
    expect(seed.sections.drug_tests).toBeUndefined();
    expect((seed.sections as Record<string, unknown>).rate_cards).toBeUndefined();
    const anyId = seed.sections.dmv?.rows[0]?.driverId;
    if (anyId) expect(dateOfHireOf(seed, anyId)).toBe("");
    expect(listSensitiveAudit().length).toBeGreaterThan(0);
  });
});
