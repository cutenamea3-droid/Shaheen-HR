import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateExpenseInput } from "@/admin/lib/expenses-logic";
import {
  datesDetailsCompatible,
  findAttachCandidates,
  validateManualAttach,
} from "@/lib/driver-hr/drug-test-matching";
import {
  clearSecureMemory,
  memoryAddDrugTest,
  memoryUpdateDrugTest,
} from "@/lib/driver-hr/secure-memory";

describe("drug matching / Vault / expense employeeIds guards", () => {
  it("groupActiveEvents tolerates non-array events (source + runtime)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/driver-hr/drug-test-matching.ts"),
      "utf8",
    );
    expect(src).toMatch(/const list = Array\.isArray\(events\) \? events : \[\]/);
    expect(findAttachCandidates({ kind: "federal_drug", driverId: "d1", specimenId: "", reason: "" } as never, "corrupt" as never)).toEqual([]);
  });

  it("matching + memory paths coerce non-string drug fields before trim", () => {
    const matchSrc = readFileSync(
      resolve(process.cwd(), "src/lib/driver-hr/drug-test-matching.ts"),
      "utf8",
    );
    expect(matchSrc).toMatch(/asDrugText\(a\.eventDate\)\.trim\(\)/);
    expect(matchSrc).toMatch(/asDrugText\(ev\.testingEventId \|\| ev\.id \|\| ""\)\.trim\(\)/);
    expect(() =>
      datesDetailsCompatible(
        { eventDate: 20261117 as unknown as string, collectionContext: null as unknown as string },
        { eventDate: "2026-11-17", collectionContext: "yard" },
      ),
    ).not.toThrow();
    expect(
      findAttachCandidates(
        {
          kind: "medical_review",
          driverId: "d1",
          specimenId: 9911 as unknown as string,
          reason: "Random" as string,
          eventDate: "" as string,
          collectionContext: "",
        },
        [
          {
            id: "e1",
            driverId: "d1",
            testingEventId: 42 as unknown as string,
            kind: "federal_drug",
            specimenId: "9911",
            reason: "Random",
            collectionContext: "",
            eventDate: "2026-11-17",
            notes: "",
            createdAt: 1,
          },
        ],
      ),
    ).toHaveLength(1);
    expect(
      validateManualAttach(
        {
          kind: "medical_review",
          driverId: "d1",
          specimenId: "9911",
          reason: "Random",
          eventDate: "2026-11-17",
          collectionContext: "",
        },
        42 as unknown as string,
        [
          {
            id: "e1",
            driverId: "d1",
            testingEventId: "42",
            kind: "federal_drug",
            specimenId: "9911",
            reason: "Random",
            collectionContext: "",
            eventDate: "2026-11-17",
            notes: "",
            createdAt: 1,
          },
        ],
      ).status,
    ).toBe("attach");

    clearSecureMemory();
    const added = memoryAddDrugTest({
      driverId: "d1",
      testingEventId: 77 as unknown as string,
      kind: "federal_drug",
      specimenId: 9911 as unknown as string,
      reason: null as unknown as string,
      collectionContext: undefined as unknown as string,
      eventDate: 20261117 as unknown as string,
      notes: 0 as unknown as string,
    });
    expect(added.testingEventId).toBe("77");
    expect(added.specimenId).toBe("9911");
    expect(added.reason).toBe("");
    const updated = memoryUpdateDrugTest(added.id, {
      testingEventId: 88 as unknown as string,
      notes: 1 as unknown as string,
    });
    expect(updated?.testingEventId).toBe("88");
    expect(updated?.notes).toBe("1");
    clearSecureMemory();
  });

  it("drug mock mutations coerce s.events before map/spread", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/driver-hr/drug-test-mock.ts"), "utf8");
    expect(src).toMatch(/const cur = Array\.isArray\(s\.events\) \? s\.events : \[\]/);
    expect(src).not.toMatch(/events: \[ev, \.\.\.s\.events\]/);
    expect(src).not.toMatch(/events: s\.events\.map/);
  });

  it("drug list API + Records page coerce events/driverIds", () => {
    const api = readFileSync(resolve(process.cwd(), "src/lib/driver-hr/drug-test-api.ts"), "utf8");
    expect(api).toMatch(/const ids = Array\.isArray\(driverIds\) \? driverIds : \[\]/);
    expect(api).toMatch(/const list = Array\.isArray\(rows\) \? rows : \[\]/);
    const page = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRecordsPage.tsx"),
      "utf8",
    );
    expect(page).toMatch(/setEvents\(Array\.isArray\(res\.events\) \? res\.events : \[\]\)/);
    expect(page).toMatch(/const safeEvents = Array\.isArray\(events\) \? events : \[\]/);
  });

  it("Vault discipline doneDates uses Array.isArray before includes/length", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/personal/components/Vault.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const doneDates = Array\.isArray\(d\.doneDates\) \? d\.doneDates : \[\]/);
    expect(src).not.toMatch(/d\.doneDates\.includes\(today\)/);
  });

  it("validateExpenseInput coerces employeeIds before .length", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/expenses-logic.ts"), "utf8");
    expect(src).toMatch(/const employeeIds = Array\.isArray\(input\.employeeIds\)/);
    const bad = validateExpenseInput({
      title: "Fuel",
      categoryId: "fuel",
      amountPkr: 100,
      expenseDate: "2026-11-17",
      scope: "all",
      employeeIds: "not-an-array" as never,
    });
    expect(bad).toEqual({ ok: true });
  });

  it("validateExpenseInput coerces non-string title before trim", () => {
    expect(() =>
      validateExpenseInput({
        title: null as unknown as string,
        categoryId: "fuel",
        amountPkr: 100,
        expenseDate: "2026-11-17",
        scope: "all",
        employeeIds: [],
      }),
    ).not.toThrow();
    expect(
      validateExpenseInput({
        title: null as unknown as string,
        categoryId: "fuel",
        amountPkr: 100,
        expenseDate: "2026-11-17",
        scope: "all",
        employeeIds: [],
      }),
    ).toEqual({ ok: false, error: "Title is required" });
  });
});
