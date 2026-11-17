import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { leaveBalance, type DayCalc } from "@/admin/lib/calc";
import { autoNote } from "@/admin/lib/reports";
import type { Employee } from "@/admin/lib/types";

const emp: Employee = {
  id: "e1",
  name: "A",
  deptId: "d",
  afterHours: false,
  joinMonth: "2026-01",
  openingLeave: 2,
};

describe("leaveBalance + reports DayCalc array guards", () => {
  it("leaveBalance tolerates corrupt non-object records", () => {
    expect(leaveBalance(emp, "2026-03-15", null as never)).toBeGreaterThanOrEqual(0);
    expect(leaveBalance(emp, "2026-03-15", "bad" as never)).toBeGreaterThanOrEqual(0);
  });

  it("autoNote coerces non-array violations", () => {
    expect(autoNote({ violations: "x" } as never)).toBe("");
    expect(autoNote({ violations: ["Late 5 min"] } as DayCalc)).toBe("Late 5 min");
  });

  it("reports.ts coerces flags/missing/violations before join/includes", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/reports.ts"), "utf8");
    expect(src).toMatch(/const violations = Array\.isArray\(c\.violations\)/);
    expect(src).toMatch(/const missing = Array\.isArray\(c\.missing\)/);
    expect(src).toMatch(/const flags = Array\.isArray\(c\.flags\)/);
  });
});
