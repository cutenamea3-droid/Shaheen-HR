import { describe, expect, it, beforeEach } from "vitest";
import {
  asPayrollPolicy,
  DEFAULT_PAYROLL_POLICY,
  usePayrollPolicyStore,
} from "@/admin/lib/payroll-policy";
import { useEmployeeFinanceMock } from "@/admin/lib/employee-finance-mock";

describe("payroll policy / finance meta object guards", () => {
  beforeEach(() => {
    usePayrollPolicyStore.getState().resetPolicy();
    useEmployeeFinanceMock.getState().resetMockSeed();
  });

  it("asPayrollPolicy heals null/array", () => {
    expect(asPayrollPolicy(null).additionalDayRatePkr).toBe(DEFAULT_PAYROLL_POLICY.additionalDayRatePkr);
    expect(asPayrollPolicy(["x"]).additionalDayRatePkr).toBe(DEFAULT_PAYROLL_POLICY.additionalDayRatePkr);
  });

  it("policy setters tolerate corrupt policy state", () => {
    usePayrollPolicyStore.setState({ policy: null as never });
    expect(usePayrollPolicyStore.getState().setAdditionalDayRate(2100).ok).toBe(true);
    expect(usePayrollPolicyStore.getState().policy.additionalDayRatePkr).toBe(2100);
  });

  it("ensureMeta / setJoiningDate tolerate corrupt meta map", () => {
    useEmployeeFinanceMock.setState({ meta: null as never });
    expect(() => useEmployeeFinanceMock.getState().ensureMeta("e_x")).not.toThrow();
    expect(useEmployeeFinanceMock.getState().setJoiningDate("e_x", "2024-01-15").ok).toBe(true);
    expect(useEmployeeFinanceMock.getState().meta.e_x?.joiningDate).toBe("2024-01-15");
  });
});
