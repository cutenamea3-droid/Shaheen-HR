/**
 * Payroll verification — Payable vs Actual Paid.
 *
 * HARD:
 * - Actual Paid ≠ Payable (never auto-equate).
 * - Bonus ≠ OT ≠ Additional Days (separate lines).
 * - Salary payments are not expenses.
 */

import type { SalaryPaymentRecord } from "./employee-finance-types";
import {
  additionalDayPayFromApproved,
  otPayFromApprovedHours,
  type PayrollPolicy,
  type PolicyDenied,
} from "./payroll-policy";
import type { OtApprovalRow } from "./ot-approval";
import { approvedMinutesForEmployee } from "./ot-approval";

export type PayableLineKind = "basic" | "overtime" | "additional_day" | "bonus";

export type PayableLine = {
  kind: PayableLineKind;
  label: string;
  amountPkr: number | null;
  /** When amount cannot be computed without policy. */
  gate: PolicyDenied | null;
  detail: string;
};

export type PayrollVerifyRow = {
  employeeId: string;
  month: string;
  lines: PayableLine[];
  /** Sum of computable payable lines only (null amounts excluded). */
  payablePkr: number;
  /** True when any line needs policy confirmation. */
  needsPolicyConfirmation: boolean;
  /** From salary payment register — Actual Paid. */
  actualPaidPkr: number;
  /** payable − actual (can be negative). */
  variancePkr: number;
  paymentStatus: SalaryPaymentRecord["status"] | "no_register_row";
};

export type BonusEntry = {
  employeeId: string;
  month: string;
  amountPkr: number;
  note: string;
};

/**
 * Build verification for one employee.
 * `basicDuePkr` comes from the salary register due (Payable basic) — never invented.
 * `bonusPkr` is a separate manual line (never merged into OT/addl).
 */
export function buildPayrollVerifyRow(input: {
  employeeId: string;
  month: string;
  policy: PayrollPolicy;
  approvals: Record<string, OtApprovalRow>;
  payment: SalaryPaymentRecord | undefined;
  bonusPkr?: number;
  bonusNote?: string;
}): PayrollVerifyRow {
  const ot = approvedMinutesForEmployee(input.approvals, input.employeeId, input.month, "overtime");
  const addl = approvedMinutesForEmployee(input.approvals, input.employeeId, input.month, "additional_day");

  const basicDue = input.payment?.amountDuePkr ?? 0;
  const lines: PayableLine[] = [
    {
      kind: "basic",
      label: "Basic salary (Payable)",
      amountPkr: basicDue,
      gate: null,
      detail: input.payment
        ? "From salary register due (manual)"
        : "No salary register row — basic Payable = 0 until due is entered",
    },
  ];

  const otPay = otPayFromApprovedHours(ot.minutes, input.policy);
  lines.push({
    kind: "overtime",
    label: "Approved overtime",
    amountPkr: otPay.ok ? otPay.amountPkr : null,
    gate: otPay.ok ? null : otPay,
    detail: `${(ot.minutes / 60).toFixed(2)} approved OT hours · never Bonus · never Additional day`,
  });

  const addlPay = additionalDayPayFromApproved(addl.days, input.policy);
  lines.push({
    kind: "additional_day",
    label: "Approved additional days",
    amountPkr: addlPay.ok ? addlPay.amountPkr : null,
    gate: addlPay.ok ? null : addlPay,
    detail: `${addl.days} approved day(s) × configurable day rate (historical ref Rs ${input.policy.additionalDayRatePkr})`,
  });

  const bonus = input.bonusPkr ?? 0;
  lines.push({
    kind: "bonus",
    label: "Bonus (manual)",
    amountPkr: bonus,
    gate: null,
    detail: input.bonusNote?.trim() || "Separate from OT and Additional days — never auto-merged",
  });

  let payablePkr = 0;
  let needsPolicyConfirmation = false;
  for (const line of lines) {
    if (line.gate && !line.gate.ok) needsPolicyConfirmation = true;
    if (line.amountPkr != null) payablePkr += line.amountPkr;
  }

  const actualPaidPkr = input.payment?.amountPaidPkr ?? 0;
  return {
    employeeId: input.employeeId,
    month: input.month,
    lines,
    payablePkr,
    needsPolicyConfirmation,
    actualPaidPkr,
    variancePkr: payablePkr - actualPaidPkr,
    paymentStatus: input.payment?.status ?? "no_register_row",
  };
}

/** Aggregate Actual Paid vs Payable across rows. */
export function summarizePayrollVerify(rows: PayrollVerifyRow[]): {
  payablePkr: number;
  actualPaidPkr: number;
  variancePkr: number;
  needsPolicyCount: number;
} {
  let payablePkr = 0;
  let actualPaidPkr = 0;
  let needsPolicyCount = 0;
  for (const r of rows) {
    payablePkr += r.payablePkr;
    actualPaidPkr += r.actualPaidPkr;
    if (r.needsPolicyConfirmation) needsPolicyCount++;
  }
  return {
    payablePkr,
    actualPaidPkr,
    variancePkr: payablePkr - actualPaidPkr,
    needsPolicyCount,
  };
}
