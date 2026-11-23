import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { leaveRoster } from "@/admin/lib/leave-management";

describe("drug records / history / inspection search coerce", () => {
  it("DrugTestRecordsPage filters use asDrugText before trim/join", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRecordsPage.tsx"),
      "utf8",
    );
    expect(src).toMatch(/asDrugText\(q\)\.trim\(\)\.toLowerCase\(\)/);
    expect(src).toMatch(/asDrugText\(draft\.testingEventId\)\.trim\(\)/);
    expect(src).toMatch(/\.map\(asDrugText\)/);
  });

  it("DrugTestRecordsPage Group by driver defaults ON (no cross-session persist)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRecordsPage.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const \[groupByDriver,\s*setGroupByDriver\]\s*=\s*useState\(true\)/);
    expect(src).not.toMatch(/localStorage.*groupByDriver|groupByDriver.*localStorage/);
    expect(src).not.toMatch(/sessionStorage.*groupByDriver|groupByDriver.*sessionStorage/);
  });

  it("ComplianceHistory + InspectionReadiness search coerce scalars", () => {
    const hist = readFileSync(
      resolve(process.cwd(), "src/components/tracker/ComplianceHistoryPanel.tsx"),
      "utf8",
    );
    expect(hist).toMatch(/asText\(q\)\.trim\(\)\.toLowerCase\(\)/);
    expect(hist).toMatch(/asText\(e\.title\)/);
    const insp = readFileSync(
      resolve(process.cwd(), "src/components/tracker/InspectionReadinessPanel.tsx"),
      "utf8",
    );
    expect(insp).toMatch(/asText\(q\)\.trim\(\)\.toLowerCase\(\)/);
    expect(insp).toMatch(/asText\(s\.driverName\)/);
  });

  it("leaveRoster coerces non-string asOf before slice", () => {
    expect(() =>
      leaveRoster([], {}, 20261117 as unknown as string),
    ).not.toThrow();
  });
});
