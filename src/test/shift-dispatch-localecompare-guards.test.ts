import { describe, expect, it } from "vitest";
import { normalizeAssignments, resolveDeptIdAsOf } from "@/admin/lib/shift-assignment";
import { dueFollowUps, openFollowUps } from "@/dispatch/lib/ops-controls";
import { driverLoadHistory } from "@/dispatch/lib/cloud";

describe("shift + dispatch localeCompare coerce", () => {
  it("normalizeAssignments / resolveDeptIdAsOf tolerate non-string effectiveFrom", () => {
    const emp = {
      deptId: "d1",
      joinMonth: "2026-01",
      deptAssignments: [
        { deptId: "d1", effectiveFrom: 20260101 as unknown as string },
        { deptId: "d2", effectiveFrom: "2026-06-01" },
      ],
    };
    expect(() => normalizeAssignments(emp)).not.toThrow();
    expect(normalizeAssignments(emp).every((a) => typeof a.effectiveFrom === "string")).toBe(true);
    expect(() => resolveDeptIdAsOf(emp, 20260315 as unknown as string)).not.toThrow();
  });

  it("dueFollowUps / openFollowUps / driverLoadHistory coerce timestamps", () => {
    const fus = [
      { id: "1", status: "open", due_at: 9 as unknown as string, title: "a" },
      { id: "2", status: "open", due_at: "2026-11-01", title: "b" },
    ] as never;
    expect(() => dueFollowUps(fus, Date.now())).not.toThrow();
    expect(() => openFollowUps(fus)).not.toThrow();
    expect(() =>
      driverLoadHistory(
        [
          {
            id: "L1",
            assigned_driver_id: "d1",
            updated_at: 3 as unknown as string,
          },
          {
            id: "L2",
            assigned_driver_id: "d1",
            updated_at: "2026-01-02",
          },
        ] as never,
        "d1",
      ),
    ).not.toThrow();
  });
});
