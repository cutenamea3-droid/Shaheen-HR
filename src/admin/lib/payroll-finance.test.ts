import { describe, expect, it, beforeEach } from "vitest";
import { HR_SYNC_KEYS } from "./hr-sync-protect";
import {
  HISTORICAL_LOCKED_MONTH,
  useEmployeeFinanceMock,
  employeeFinancePersistenceGuard,
} from "./employee-finance-mock";
import { derivePaymentStatus, assertWholePkr } from "./salary-payments";
import {
  collectOtCandidates,
  otApprovalId,
  otApprovalPersistenceGuard,
  useOtApprovalStore,
  approvedMinutesForEmployee,
} from "./ot-approval";
import {
  DEFAULT_PAYROLL_POLICY,
  HISTORICAL_ADDITIONAL_DAY_RATE_PKR,
  dailyRateFromMonthlyBasic,
  otPayFromApprovedHours,
  additionalDayPayFromApproved,
  payrollPolicyPersistenceGuard,
  usePayrollPolicyStore,
} from "./payroll-policy";
import { buildPayrollVerifyRow, summarizePayrollVerify } from "./payroll-verify";
import { bonusPersistenceGuard, useBonusStore } from "./bonus-store";
import type { DayRec, Dept, Employee, Settings } from "./types";
import { emptyRec } from "./types";

const settings: Settings = {
  company: "",
  grace: 15,
  breakMin: 45,
  breakLeeway: 3,
  satTargetHours: 4,
  overpay: true,
};

const dept: Dept = { id: "hr", name: "HR", start: 300, end: 900 };
const emp: Employee = {
  id: "e1",
  name: "Test",
  deptId: "hr",
  afterHours: false,
  joinMonth: "2024-01",
  openingLeave: 0,
};

function rec(over: Partial<DayRec> = {}): DayRec {
  return { ...emptyRec(), ...over, in: 300, bin: 540, bout: 585, out: 1020, otMarked: true };
}

describe("salary payments — Actual Paid ≠ Payable", () => {
  beforeEach(() => {
    useEmployeeFinanceMock.getState().resetMockSeed();
  });

  it("derivePaymentStatus never jumps from hours — paid only from amounts", () => {
    expect(derivePaymentStatus(100000, 0)).toBe("unpaid");
    expect(derivePaymentStatus(100000, 40000)).toBe("partial");
    expect(derivePaymentStatus(100000, 100000)).toBe("paid");
    expect(derivePaymentStatus(100000, 0, true)).toBe("on_hold");
  });

  it("locks Oct 2026 historical due rewrite", () => {
    const s = useEmployeeFinanceMock.getState();
    expect(HISTORICAL_LOCKED_MONTH).toBe("2026-10");
    const existing = s.paymentsForMonth("2026-10").find((p) => p.employeeId === "mock-emp-a1");
    expect(existing?.amountPaidPkr).toBe(185000);
    const r = s.upsertPaymentDue("mock-emp-a1", "2026-10", 200000);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/locked/i);
    expect(useEmployeeFinanceMock.getState().paymentsForMonth("2026-10").find((p) => p.id === existing!.id)?.amountDuePkr).toBe(
      185000,
    );
  });

  it("allows due upsert on non-historical months", () => {
    const r = useEmployeeFinanceMock.getState().upsertPaymentDue("mock-emp-a1", "2026-11", 190000);
    expect(r.ok).toBe(true);
    const row = useEmployeeFinanceMock.getState().paymentsForMonth("2026-11").find((p) => p.employeeId === "mock-emp-a1");
    expect(row?.amountDuePkr).toBe(190000);
    expect(row?.amountPaidPkr).toBe(0);
  });

  it("keeps banking/salary off HR_SYNC_KEYS", () => {
    expect(employeeFinancePersistenceGuard().usesLocalStorage).toBe(false);
    expect(HR_SYNC_KEYS).not.toContain("payments" as never);
    expect(HR_SYNC_KEYS).not.toContain("banking" as never);
  });
});

describe("OT approval — Bonus ≠ OT ≠ Additional Days", () => {
  beforeEach(() => {
    useOtApprovalStore.getState().resetApprovals();
  });

  it("collects separate OT and additional-day candidates", () => {
    const wed = "2026-11-04"; // Wednesday
    const sun = "2026-11-08"; // Sunday → natural additional day for normal staff
    const records: Record<string, Record<string, DayRec>> = {
      [wed]: { e1: rec({ otMarked: true, out: 1020 }) },
      [sun]: { e1: { ...emptyRec(), status: "present", in: 300, bin: 540, bout: 585, out: 900 } },
    };
    const cands = collectOtCandidates({
      employees: [emp],
      depts: [dept],
      records,
      settings,
      month: "2026-11",
    });
    expect(cands.some((c) => c.kind === "overtime")).toBe(true);
    expect(cands.some((c) => c.kind === "additional_day")).toBe(true);
    expect(cands.every((c) => c.kind !== ("bonus" as never))).toBe(true);
  });

  it("approves OT without affecting additional-day totals", () => {
    const store = useOtApprovalStore.getState();
    store.ensureCandidate({ employeeId: "e1", date: "2026-11-04", kind: "overtime", minutes: 120 });
    store.ensureCandidate({ employeeId: "e1", date: "2026-11-08", kind: "additional_day", minutes: 480 });
    const otId = otApprovalId("e1", "2026-11-04", "overtime");
    expect(store.setStatus(otId, "approved").ok).toBe(true);
    const ot = approvedMinutesForEmployee(useOtApprovalStore.getState().rows, "e1", "2026-11", "overtime");
    const addl = approvedMinutesForEmployee(useOtApprovalStore.getState().rows, "e1", "2026-11", "additional_day");
    expect(ot.minutes).toBe(120);
    expect(addl.days).toBe(0);
    expect(otApprovalPersistenceGuard().usesLocalStorage).toBe(false);
  });
});

describe("payroll policy — no invented divisors; configurable day rate", () => {
  beforeEach(() => {
    usePayrollPolicyStore.getState().resetPolicy();
  });

  it("defaults additional day rate to historical 2000 (configurable)", () => {
    expect(HISTORICAL_ADDITIONAL_DAY_RATE_PKR).toBe(2000);
    expect(usePayrollPolicyStore.getState().policy.additionalDayRatePkr).toBe(2000);
    expect(usePayrollPolicyStore.getState().setAdditionalDayRate(2500).ok).toBe(true);
    expect(usePayrollPolicyStore.getState().policy.additionalDayRatePkr).toBe(2500);
  });

  it("blocks daily rate until divisor set AND confirmed (no invent 26/27)", () => {
    const blocked = dailyRateFromMonthlyBasic(260000, DEFAULT_PAYROLL_POLICY);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toMatch(/Needs Policy Confirmation/);

    usePayrollPolicyStore.getState().setWorkingDaysDivisor(26);
    const unconfirmed = dailyRateFromMonthlyBasic(260000, usePayrollPolicyStore.getState().policy);
    expect(unconfirmed.ok).toBe(false);

    usePayrollPolicyStore.getState().confirmDivisorPolicy(true);
    const ok = dailyRateFromMonthlyBasic(260000, usePayrollPolicyStore.getState().policy);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.dailyPkr).toBe(10000);
  });

  it("OT pay Needs Policy when hourly rate unset", () => {
    const r = otPayFromApprovedHours(120, DEFAULT_PAYROLL_POLICY);
    expect(r.ok).toBe(false);
    usePayrollPolicyStore.getState().setOvertimeHourlyRate(500);
    const pay = otPayFromApprovedHours(120, usePayrollPolicyStore.getState().policy);
    expect(pay.ok).toBe(true);
    if (pay.ok) expect(pay.amountPkr).toBe(1000);
  });

  it("additional day pay uses configurable rate", () => {
    const pay = additionalDayPayFromApproved(3, DEFAULT_PAYROLL_POLICY);
    expect(pay.ok).toBe(true);
    if (pay.ok) expect(pay.amountPkr).toBe(6000);
    expect(payrollPolicyPersistenceGuard().syncKeysSafe).toBe(true);
  });
});

describe("payroll verify — Payable vs Actual Paid + Bonus line", () => {
  beforeEach(() => {
    useOtApprovalStore.getState().resetApprovals();
    useBonusStore.getState().resetBonuses();
    usePayrollPolicyStore.getState().resetPolicy();
    usePayrollPolicyStore.getState().setOvertimeHourlyRate(500);
  });

  it("keeps Bonus as a separate payable line and shows variance", () => {
    const approvals = useOtApprovalStore.getState();
    approvals.ensureCandidate({ employeeId: "e1", date: "2026-11-04", kind: "overtime", minutes: 120 });
    approvals.setStatus(otApprovalId("e1", "2026-11-04", "overtime"), "approved");
    approvals.ensureCandidate({ employeeId: "e1", date: "2026-11-08", kind: "additional_day", minutes: 480 });
    approvals.setStatus(otApprovalId("e1", "2026-11-08", "additional_day"), "approved");
    useBonusStore.getState().upsertBonus("e1", "2026-11", 10000, "festival");

    const row = buildPayrollVerifyRow({
      employeeId: "e1",
      month: "2026-11",
      policy: usePayrollPolicyStore.getState().policy,
      approvals: useOtApprovalStore.getState().rows,
      payment: {
        id: "p1",
        employeeId: "e1",
        month: "2026-11",
        amountDuePkr: 100000,
        amountPaidPkr: 50000,
        status: "partial",
        bankingAccountId: null,
        paidOn: "2026-11-10",
        note: "",
        updatedAt: 1,
      },
      bonusPkr: 10000,
      bonusNote: "festival",
    });

    expect(row.lines.map((l) => l.kind)).toEqual(["basic", "overtime", "additional_day", "bonus"]);
    expect(row.lines.find((l) => l.kind === "bonus")?.amountPkr).toBe(10000);
    expect(row.lines.find((l) => l.kind === "overtime")?.amountPkr).toBe(1000);
    expect(row.lines.find((l) => l.kind === "additional_day")?.amountPkr).toBe(2000);
    expect(row.actualPaidPkr).toBe(50000);
    expect(row.payablePkr).toBe(100000 + 1000 + 2000 + 10000);
    expect(row.variancePkr).toBe(row.payablePkr - 50000);
    expect(row.actualPaidPkr).not.toBe(row.payablePkr);

    const sum = summarizePayrollVerify([row]);
    expect(sum.actualPaidPkr).toBe(50000);
    expect(bonusPersistenceGuard().usesLocalStorage).toBe(false);
  });

  it("whole PKR only", () => {
    expect(() => assertWholePkr(10.5)).toThrow();
  });
});
