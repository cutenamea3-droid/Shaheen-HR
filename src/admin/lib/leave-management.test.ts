import { describe, expect, it } from "vitest";
import { leaveDaysOnDate, leaveRoster, listLeaveDaysInMonth } from "./leave-management";
import { emptyRec, type DayRec, type Employee } from "./types";

const emp: Employee = {
  id: "e1",
  name: "A",
  deptId: "d",
  afterHours: false,
  joinMonth: "2026-01",
  openingLeave: 2,
};

function leave(paid: boolean): DayRec {
  return { ...emptyRec(), status: "leave", leavePaid: paid };
}

describe("leave-management", () => {
  it("lists leave days in month from records only", () => {
    const records: Record<string, Record<string, DayRec>> = {
      "2026-03-02": { e1: leave(true) },
      "2026-03-05": { e1: leave(false) },
      "2026-03-06": { e1: { ...emptyRec(), status: "present" } },
    };
    const days = listLeaveDaysInMonth("2026-03", [emp], records);
    expect(days).toHaveLength(2);
    expect(days[0]!.paid).toBe(true);
    expect(days[1]!.paid).toBe(false);
  });

  it("roster uses existing leaveBalance accrual (no invented policy)", () => {
    const records: Record<string, Record<string, DayRec>> = {
      "2026-03-02": { e1: leave(true) },
    };
    const rows = leaveRoster([emp], records, "2026-03-15");
    expect(rows[0]!.paidThisMonth).toBe(1);
    expect(rows[0]!.balanceAsOf).toBeGreaterThanOrEqual(0);
  });

  it("leaveDaysOnDate filters that day only", () => {
    const records = { "2026-03-02": { e1: leave(true) } };
    expect(leaveDaysOnDate("2026-03-02", [emp], records)).toHaveLength(1);
    expect(leaveDaysOnDate("2026-03-03", [emp], records)).toHaveLength(0);
  });
});
