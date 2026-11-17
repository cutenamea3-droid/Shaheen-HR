import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePersonal } from "@/personal/lib/store";
import {
  approvedMinutesForEmployee,
  useOtApprovalStore,
} from "@/admin/lib/ot-approval";
import { useEmployeeFinanceMock } from "@/admin/lib/employee-finance-mock";

describe("Today / dayPlans / OT approval / finance mock guards", () => {
  it("Today.tsx coerces courses/sessions/assessments/backlog/dayPlans", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Today.tsx"), "utf8");
    expect(src).toMatch(/coursesRaw/);
    expect(src).toMatch(/Array\.isArray\(coursesRaw\)/);
    expect(src).toMatch(/Array\.isArray\(backlogRaw\)/);
  });

  it("ensureDayPlan / rebuildDayBlocks heal corrupt dayPlans + buildBlocks arrays", () => {
    usePersonal.setState({
      dayPlans: null as unknown as Record<string, never>,
      courses: "x" as unknown as [],
      backlog: null as unknown as [],
    });
    expect(() => usePersonal.getState().ensureDayPlan("2026-11-17")).not.toThrow();
    expect(usePersonal.getState().dayPlans["2026-11-17"]).toBeTruthy();
    expect(Array.isArray(usePersonal.getState().dayPlans["2026-11-17"]!.blocks)).toBe(true);
    expect(() => usePersonal.getState().rebuildDayBlocks("2026-11-17")).not.toThrow();
  });

  it("OT approval store and approvedMinutesForEmployee tolerate non-object rows", () => {
    useOtApprovalStore.setState({ rows: null as unknown as Record<string, never> });
    expect(() =>
      useOtApprovalStore.getState().ensureCandidate({
        employeeId: "e1",
        date: "2026-11-01",
        kind: "overtime",
        minutes: 30,
      }),
    ).not.toThrow();
    expect(
      approvedMinutesForEmployee(null as unknown as Record<string, never>, "e1", "2026-11", "overtime"),
    ).toEqual({ minutes: 0, days: 0 });
  });

  it("employee-finance-mock banking/payments tolerate non-arrays", () => {
    useEmployeeFinanceMock.setState({
      banking: null as unknown as [],
      payments: "bad" as unknown as [],
      events: undefined as unknown as [],
    });
    expect(() => useEmployeeFinanceMock.getState().currentBanking("e1")).not.toThrow();
    expect(useEmployeeFinanceMock.getState().paymentsForMonth("2026-11")).toEqual([]);
    expect(useEmployeeFinanceMock.getState().upsertPaymentDue("e1", "2026-11", 1000).ok).toBe(true);
    expect(Array.isArray(useEmployeeFinanceMock.getState().payments)).toBe(true);
  });
});
