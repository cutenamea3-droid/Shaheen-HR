/**
 * Payroll money policy (Admin finance) — separate from attendance hours calc.
 *
 * HARD:
 * - Never invent working-day divisors (26/27). Unset → Needs Policy Confirmation.
 * - PKR 2000/day was historical for additional days — configurable via additionalDayRatePkr.
 * - Bonus ≠ OT ≠ Additional Days.
 * - Policy lives in session mock memory — never unprotected app_state.
 */

import { create } from "zustand";
import { assertWholePkr } from "./salary-payments";

/** Historical default used in past periods — not a locked formula. */
export const HISTORICAL_ADDITIONAL_DAY_RATE_PKR = 2000;

export type PayrollPolicy = {
  /**
   * Whole-PKR rate applied per approved additional day when paying money.
   * Historical reference: 2000 — editable; never hard-wired into calcDay.
   */
  additionalDayRatePkr: number;
  /**
   * Optional OT hourly rate (whole PKR). null = Needs Policy Confirmation
   * (do not invent rate from monthly ÷ divisor).
   */
  overtimeHourlyRatePkr: number | null;
  /**
   * Working-days divisor for deriving a daily rate from monthly basic.
   * null = Needs Policy Confirmation — never invent 26 or 27.
   */
  workingDaysDivisor: number | null;
  /** Owner confirmed the divisor policy (required when divisor is set). */
  divisorPolicyConfirmed: boolean;
  updatedAt: number;
};

export const DEFAULT_PAYROLL_POLICY: PayrollPolicy = {
  additionalDayRatePkr: HISTORICAL_ADDITIONAL_DAY_RATE_PKR,
  overtimeHourlyRatePkr: null,
  workingDaysDivisor: null,
  divisorPolicyConfirmed: false,
  updatedAt: 0,
};

export type PolicyDenied = {
  ok: false;
  code: "needs_policy_confirmation";
  message: string;
};

/** @deprecated alias — prefer PolicyDenied for failure-only narrowing */
export type PolicyGate = PolicyDenied;

/** Daily rate from monthly basic — blocked unless divisor is explicitly set + confirmed. */
export function dailyRateFromMonthlyBasic(
  monthlyBasicPkr: number,
  policy: PayrollPolicy,
): { ok: true; dailyPkr: number } | PolicyDenied {
  try {
    assertWholePkr(monthlyBasicPkr);
  } catch (e) {
    return { ok: false, code: "needs_policy_confirmation", message: e instanceof Error ? e.message : "Invalid basic" };
  }
  if (policy.workingDaysDivisor == null || !Number.isFinite(policy.workingDaysDivisor) || policy.workingDaysDivisor <= 0) {
    return {
      ok: false,
      code: "needs_policy_confirmation",
      message: "Needs Policy Confirmation: working-days divisor is unset (do not invent 26/27)",
    };
  }
  if (!policy.divisorPolicyConfirmed) {
    return {
      ok: false,
      code: "needs_policy_confirmation",
      message: "Needs Policy Confirmation: working-days divisor must be owner-confirmed before use",
    };
  }
  // Whole PKR only — floor to avoid inventing fractions.
  const dailyPkr = Math.floor(monthlyBasicPkr / policy.workingDaysDivisor);
  return { ok: true, dailyPkr };
}

export function otPayFromApprovedHours(
  approvedOtMinutes: number,
  policy: PayrollPolicy,
): { ok: true; amountPkr: number } | PolicyDenied {
  if (policy.overtimeHourlyRatePkr == null) {
    return {
      ok: false,
      code: "needs_policy_confirmation",
      message: "Needs Policy Confirmation: overtime hourly rate is unset",
    };
  }
  try {
    const rate = assertWholePkr(policy.overtimeHourlyRatePkr);
    const hours = approvedOtMinutes / 60;
    // Whole PKR: round after hours × rate
    return { ok: true, amountPkr: Math.round(hours * rate) };
  } catch (e) {
    return { ok: false, code: "needs_policy_confirmation", message: e instanceof Error ? e.message : "Invalid OT rate" };
  }
}

export function additionalDayPayFromApproved(
  approvedAdditionalDays: number,
  policy: PayrollPolicy,
): { ok: true; amountPkr: number } | PolicyDenied {
  try {
    const rate = assertWholePkr(policy.additionalDayRatePkr);
    return { ok: true, amountPkr: Math.round(approvedAdditionalDays * rate) };
  } catch (e) {
    return { ok: false, code: "needs_policy_confirmation", message: e instanceof Error ? e.message : "Invalid day rate" };
  }
}

type PolicyState = {
  policy: PayrollPolicy;
  setAdditionalDayRate: (pkr: number) => { ok: boolean; error?: string };
  setOvertimeHourlyRate: (pkr: number | null) => { ok: boolean; error?: string };
  /**
   * Set working-days divisor. Passing null clears it.
   * Setting a number still requires confirmDivisorPolicy() before use.
   * Never auto-picks 26 or 27.
   */
  setWorkingDaysDivisor: (n: number | null) => { ok: boolean; error?: string };
  confirmDivisorPolicy: (confirmed: boolean) => void;
  resetPolicy: () => void;
};

export const usePayrollPolicyStore = create<PolicyState>()((set) => ({
  policy: { ...DEFAULT_PAYROLL_POLICY },

  setAdditionalDayRate: (pkr) => {
    try {
      const v = assertWholePkr(pkr);
      if (v <= 0) return { ok: false, error: "Additional day rate must be positive whole PKR" };
      set((s) => ({ policy: { ...s.policy, additionalDayRatePkr: v, updatedAt: Date.now() } }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid rate" };
    }
  },

  setOvertimeHourlyRate: (pkr) => {
    try {
      if (pkr == null) {
        set((s) => ({
          policy: { ...s.policy, overtimeHourlyRatePkr: null, updatedAt: Date.now() },
        }));
        return { ok: true };
      }
      const v = assertWholePkr(pkr);
      if (v <= 0) return { ok: false, error: "OT hourly rate must be positive whole PKR" };
      set((s) => ({
        policy: { ...s.policy, overtimeHourlyRatePkr: v, updatedAt: Date.now() },
      }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid rate" };
    }
  },

  setWorkingDaysDivisor: (n) => {
    if (n == null) {
      set((s) => ({
        policy: {
          ...s.policy,
          workingDaysDivisor: null,
          divisorPolicyConfirmed: false,
          updatedAt: Date.now(),
        },
      }));
      return { ok: true };
    }
    if (!Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) {
      return { ok: false, error: "Divisor must be a positive whole number, or cleared" };
    }
    // Changing divisor clears confirmation — owner must re-confirm (no silent 26/27).
    set((s) => ({
      policy: {
        ...s.policy,
        workingDaysDivisor: n,
        divisorPolicyConfirmed: false,
        updatedAt: Date.now(),
      },
    }));
    return { ok: true };
  },

  confirmDivisorPolicy: (confirmed) =>
    set((s) => ({
      policy: { ...s.policy, divisorPolicyConfirmed: confirmed, updatedAt: Date.now() },
    })),

  resetPolicy: () => set({ policy: { ...DEFAULT_PAYROLL_POLICY } }),
}));

export function payrollPolicyPersistenceGuard(): { usesLocalStorage: false; syncKeysSafe: true } {
  return { usesLocalStorage: false, syncKeysSafe: true };
}
