import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { leaveBalance, monthDays, shortDate, weekday, type DayCalc } from "@/admin/lib/calc";
import { autoNote, monthLabel } from "@/admin/lib/reports";
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

  it("weekday / shortDate / monthDays / leaveBalance / monthLabel coerce non-string dates", () => {
    expect(() => weekday(20261117 as unknown as string)).not.toThrow();
    expect(() => shortDate(null as unknown as string)).not.toThrow();
    expect(() => monthDays(202611 as unknown as string)).not.toThrow();
    expect(monthDays("2026-11")).toHaveLength(30);
    expect(() =>
      leaveBalance(
        { ...emp, joinMonth: 202601 as unknown as string },
        20260315 as unknown as string,
        {},
      ),
    ).not.toThrow();
    expect(() => monthLabel(202611 as unknown as string)).not.toThrow();
    expect(monthLabel("2026-11")).toMatch(/2026/);
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

  it("monthly-report-model + perf-followups + Attendance coerce DayCalc arrays", () => {
    const model = readFileSync(
      resolve(process.cwd(), "src/admin/lib/monthly-report-model.ts"),
      "utf8",
    );
    const fu = readFileSync(resolve(process.cwd(), "src/admin/lib/perf-followups.ts"), "utf8");
    const att = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"),
      "utf8",
    );
    expect(model).toMatch(/Array\.isArray\(x\.c\.violations\)/);
    expect(model).toMatch(/Array\.isArray\(x\.c\.missing\)/);
    expect(fu).toMatch(/Array\.isArray\(c\.missing\)/);
    expect(att).toMatch(/Array\.isArray\(c\.flags\)/);
    expect(att).toMatch(/Array\.isArray\(c\.missing\)/);
    expect(att).toMatch(/Array\.isArray\(c\.violations\)/);
  });
});
