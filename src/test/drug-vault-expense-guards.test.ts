import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateExpenseInput } from "@/admin/lib/expenses-logic";
import { findAttachCandidates } from "@/lib/driver-hr/drug-test-matching";

describe("drug matching / Vault / expense employeeIds guards", () => {
  it("groupActiveEvents tolerates non-array events (source + runtime)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/driver-hr/drug-test-matching.ts"),
      "utf8",
    );
    expect(src).toMatch(/const list = Array\.isArray\(events\) \? events : \[\]/);
    expect(findAttachCandidates({ kind: "federal_drug", driverId: "d1", specimenId: "", reason: "" } as never, "corrupt" as never)).toEqual([]);
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
});
