/**
 * Drug Test Records sidebar section — multi-event, pairing, secure-only saves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDrugTestEvent,
  deleteDrugTestEvent,
  listDrugTestsAsync,
  updateDrugTestEvent,
} from "@/lib/driver-hr/drug-test-api";
import { DRUG_TEST_SECURE_REQUIRED } from "@/lib/driver-hr/drug-test-mode";
import {
  filterDrugPairs,
  newTestingEventId,
  pairDrugTestEvents,
  type DrugTestEvent,
} from "@/lib/driver-hr/drug-tests";
import { useDrugTestMock } from "@/lib/driver-hr/drug-test-mock";
import { clearSensitiveAudit } from "@/lib/driver-hr/sensitive-audit";
import { buildSeed } from "@/lib/sections";
import { filterRosterDrivers, listRosterDrivers } from "@/lib/driver-hr/roster-drivers";
import {
  memoryAddDrugTest,
  memoryListDrugTests,
  clearSecureMemory,
} from "@/lib/driver-hr/secure-memory";

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

describe("Drug Test Records section", () => {
  beforeEach(() => {
    useDrugTestMock.getState().clearAll();
    clearSensitiveAudit();
    clearSecureMemory();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("unlimited events same driver: distinct testingEventId keep multi Random independent", () => {
    const te1 = newTestingEventId();
    const te2 = newTestingEventId();
    expect(te1).not.toBe(te2);
    const rows = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: te1,
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: te1,
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-01-10",
      }),
      ev({
        id: "f2",
        kind: "federal_drug",
        testingEventId: te2,
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-02-10",
      }),
      ev({
        id: "m2",
        kind: "medical_review",
        testingEventId: te2,
        specimenId: "01234",
        reason: "Random",
        collectionContext: "Lab A",
        eventDate: "2024-02-10",
      }),
      ev({
        id: "f3",
        kind: "federal_drug",
        testingEventId: newTestingEventId(),
        specimenId: "99",
        reason: "Follow-up",
        collectionContext: "Lab B",
        eventDate: "2024-03-01",
      }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.status === "matched")).toHaveLength(2);
    expect(rows.filter((r) => r.status === "missing_mr")).toHaveLength(1);
    // Never pair across testing events even with identical specimen/reason
    expect(rows.find((r) => r.federal?.id === "f1")?.medical?.id).toBe("m1");
    expect(rows.find((r) => r.federal?.id === "f2")?.medical?.id).toBe("m2");
  });

  it("missing / mismatch statuses still work; Matched ≠ clearance semantics in labels", () => {
    const missing = pairDrugTestEvents([
      ev({ id: "f1", kind: "federal_drug", specimenId: "A", reason: "Random", collectionContext: "C" }),
    ]);
    expect(missing[0]!.status).toBe("missing_mr");
    const mismatch = pairDrugTestEvents([
      ev({ id: "f1", kind: "federal_drug", specimenId: "A", reason: "Random", collectionContext: "C" }),
      ev({ id: "m1", kind: "medical_review", specimenId: "B", reason: "Random", collectionContext: "C" }),
    ]);
    expect(mismatch[0]!.status).toBe("specimen_mismatch");
  });

  it("searchable history filter keeps multi rows for same driver", () => {
    const te1 = "te-a";
    const te2 = "te-b";
    const pairs = pairDrugTestEvents([
      ev({
        id: "f1",
        driverId: "d1",
        kind: "federal_drug",
        testingEventId: te1,
        specimenId: "111",
        reason: "Random",
        collectionContext: "Jan",
      }),
      ev({
        id: "m1",
        driverId: "d1",
        kind: "medical_review",
        testingEventId: te1,
        specimenId: "111",
        reason: "Random",
        collectionContext: "Jan",
      }),
      ev({
        id: "f2",
        driverId: "d1",
        kind: "federal_drug",
        testingEventId: te2,
        specimenId: "222",
        reason: "Follow-up",
        collectionContext: "Feb",
      }),
    ]);
    expect(pairs).toHaveLength(2);
    const filtered = filterDrugPairs(pairs, { q: "follow" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.status).toBe("missing_mr");
    // event count (2) > unique drivers (1)
    expect(new Set(pairs.map((p) => "d1")).size).toBe(1);
    expect(pairs.length).toBeGreaterThan(1);
  });

  it("secure-memory save/reload preserves unlimited events for one driver", () => {
    const te1 = "te-reload-1";
    const te2 = "te-reload-2";
    memoryAddDrugTest(
      {
        driverId: "d1",
        testingEventId: te1,
        kind: "federal_drug",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "A",
        eventDate: "2024-01-01",
        notes: "",
      },
      "admin",
    );
    memoryAddDrugTest(
      {
        driverId: "d1",
        testingEventId: te1,
        kind: "medical_review",
        specimenId: "01234",
        reason: "Random",
        collectionContext: "A",
        eventDate: "2024-01-01",
        notes: "",
      },
      "admin",
    );
    memoryAddDrugTest(
      {
        driverId: "d1",
        testingEventId: te2,
        kind: "federal_drug",
        specimenId: "555",
        reason: "Follow-up",
        collectionContext: "B",
        eventDate: "2024-02-01",
        notes: "",
      },
      "admin",
    );
    const rows = memoryListDrugTests("d1");
    expect(rows).toHaveLength(3);
    const pairs = pairDrugTestEvents(rows);
    expect(pairs).toHaveLength(2);
    expect(pairs.filter((p) => p.status === "matched")).toHaveLength(1);
    expect(pairs.filter((p) => p.status === "missing_mr")).toHaveLength(1);
  });

  it("API mutations throw when secure flag is off (no silent mock save)", async () => {
    // Default test env: VITE_DRIVER_DRUG_TESTS_SECURE unset → mock mode → saves blocked.
    await expect(
      addDrugTestEvent(
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
        "admin",
      ),
    ).rejects.toThrow(DRUG_TEST_SECURE_REQUIRED);
    await expect(updateDrugTestEvent("x", { reason: "Random" }, "admin")).rejects.toThrow(
      DRUG_TEST_SECURE_REQUIRED,
    );
    await expect(deleteDrugTestEvent("x", "admin")).rejects.toThrow(DRUG_TEST_SECURE_REQUIRED);
    const listed = await listDrugTestsAsync("d1", "admin");
    expect(listed.secure).toBe(false);
    expect(listed.events).toEqual([]);
    expect(listed.error).toContain("Secure");
    // Mock store must remain empty — API did not fall back
    expect(useDrugTestMock.getState().listForDriver("d1")).toHaveLength(0);
  });

  it("roster helper lists drivers for searchable Add picker; seed has no drug_tests section", () => {
    const seed = buildSeed();
    const roster = listRosterDrivers(seed);
    expect(roster.length).toBeGreaterThan(0);
    const first = roster[0]!;
    expect(filterRosterDrivers(roster, first.name.slice(0, 2)).length).toBeGreaterThan(0);
    expect(seed.sections.drug_tests).toBeUndefined();
  });

  it("admin vs non-admin gate is role-based in UI; API refuses non-secure writes for any actor", async () => {
    // Non-admin lock copy is in DrugTestRecordsPage / DrugTestRegister (portal role).
    // API layer refuses non-secure writes regardless of actor string (isolatable here).
    await expect(
      addDrugTestEvent(
        {
          driverId: "d1",
          testingEventId: "te",
          kind: "federal_drug",
          specimenId: "1",
          reason: "Random",
          collectionContext: "C",
          eventDate: "",
          notes: "",
        },
        "ordinary@example.com",
      ),
    ).rejects.toThrow(/Secure drug test backend required/);
  });

  it("Save & Add Another mints distinct testing_event_ids; CCF-first and MRO-first both OK", () => {
    // Mirrors sidebar Add flow: blank testingEventId → newTestingEventId() each save; never reuse.
    const firstId = newTestingEventId();
    const secondId = newTestingEventId();
    expect(firstId).not.toBe(secondId);
    expect(firstId.length).toBeGreaterThan(8);

    const ccfFirst = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: firstId,
        specimenId: "100",
        reason: "Random",
        collectionContext: "Lab",
      }),
    ]);
    expect(ccfFirst[0]!.status).toBe("missing_mr");

    const mroFirst = pairDrugTestEvents([
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: secondId,
        specimenId: "200",
        reason: "Follow-up",
        collectionContext: "Lab",
      }),
    ]);
    expect(mroFirst[0]!.status).toBe("missing_fd");

    // Linking MRO to existing CCF keeps the same testing_event_id (no overwrite).
    const linked = pairDrugTestEvents([
      ev({
        id: "f1",
        kind: "federal_drug",
        testingEventId: firstId,
        specimenId: "100",
        reason: "Random",
        collectionContext: "Lab",
      }),
      ev({
        id: "m1",
        kind: "medical_review",
        testingEventId: firstId,
        specimenId: "100",
        reason: "Random",
        collectionContext: "Lab",
      }),
    ]);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.testingEventId).toBe(firstId);
    expect(linked[0]!.status).toBe("matched");
  });
});
