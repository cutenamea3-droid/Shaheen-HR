import { describe, expect, it } from "vitest";
import {
  appendDeptAssignment,
  normalizeAssignments,
  resolveDeptAsOf,
  resolveDeptIdAsOf,
} from "./shift-assignment";
import type { Dept, Employee } from "./types";

const depts: Dept[] = [
  { id: "hr", name: "HR", start: 360, end: 960 },
  { id: "dispatch", name: "Dispatch", start: 300, end: 900 },
];

const base: Employee = {
  id: "e1",
  name: "A",
  deptId: "hr",
  afterHours: false,
  joinMonth: "2025-01",
  openingLeave: 0,
};

describe("shift-assignment history", () => {
  it("seeds current dept from joinMonth when history missing", () => {
    expect(normalizeAssignments(base)).toEqual([{ deptId: "hr", effectiveFrom: "2025-01-01" }]);
    expect(resolveDeptIdAsOf(base, "2025-06-15")).toBe("hr");
  });

  it("preserves historical effective dates across dept changes", () => {
    const after = appendDeptAssignment(base, "dispatch", "2026-03-01");
    expect(after.deptAssignments).toEqual([
      { deptId: "hr", effectiveFrom: "2025-01-01" },
      { deptId: "dispatch", effectiveFrom: "2026-03-01" },
    ]);
    expect(resolveDeptIdAsOf({ ...base, ...after }, "2026-02-28")).toBe("hr");
    expect(resolveDeptIdAsOf({ ...base, ...after }, "2026-03-01")).toBe("dispatch");
    expect(resolveDeptAsOf({ ...base, ...after }, depts, "2026-02-28")?.name).toBe("HR");
    expect(resolveDeptAsOf({ ...base, ...after }, depts, "2026-03-15")?.name).toBe("Dispatch");
  });

  it("does not invent a duplicate row when dept unchanged", () => {
    const once = appendDeptAssignment(base, "hr", "2026-04-01");
    expect(once.deptAssignments).toHaveLength(1);
  });

  it("same-day reassignment replaces that day's row only", () => {
    const a = appendDeptAssignment(base, "dispatch", "2026-05-10");
    const b = appendDeptAssignment({ ...base, ...a }, "hr", "2026-05-10");
    expect(b.deptAssignments.filter((x) => x.effectiveFrom === "2026-05-10")).toEqual([
      { deptId: "hr", effectiveFrom: "2026-05-10" },
    ]);
    expect(b.deptAssignments.some((x) => x.deptId === "hr" && x.effectiveFrom === "2025-01-01")).toBe(
      true,
    );
  });
});
