import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("inspection / expenses UI list guards", () => {
  it("InspectionReadinessPanel coerces summaries and items", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/InspectionReadinessPanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Array\.isArray\(list\) \? list : \[\]/);
    expect(src).toMatch(/Array\.isArray\(s\.items\) \? s\.items : \[\]/);
  });

  it("ExpensesManagement coerces store arrays and byCategory object", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Array\.isArray\(expensesRaw\)/);
    expect(src).toMatch(/!Array\.isArray\(summary\.byCategory\)/);
    expect(src).toMatch(/Object\.entries\(byCategory\)/);
  });

  it("DrugTestRecordsPage coerces roster list", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRecordsPage.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Array\.isArray\(list\) \? list : \[\]/);
  });
});
