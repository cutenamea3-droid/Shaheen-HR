import type { SalaryPaymentRecord, SalaryPaymentStatus } from "./employee-finance-types";

/** Whole PKR only — reject fractions. */
export function assertWholePkr(n: number): number {
  if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be a non-negative number");
  const whole = Math.round(n);
  if (whole !== n) throw new Error("PKR amounts must be whole numbers");
  return whole;
}

export function formatPkr(n: number): string {
  const v = Math.round(n);
  return `Rs ${v.toLocaleString("en-PK")}`;
}

/**
 * Derive status from amounts — never jumps to Paid from payroll hours.
 * Explicit `on_hold` is preserved when caller passes it.
 */
export function derivePaymentStatus(
  amountDuePkr: number,
  amountPaidPkr: number,
  preferHold = false,
): SalaryPaymentStatus {
  const due = assertWholePkr(amountDuePkr);
  const paid = assertWholePkr(amountPaidPkr);
  if (preferHold) return "on_hold";
  if (paid <= 0) return "unpaid";
  if (paid < due) return "partial";
  return "paid";
}

export function applyPartialPayment(
  row: SalaryPaymentRecord,
  addPkr: number,
  paidOn: string,
): SalaryPaymentRecord {
  const add = assertWholePkr(addPkr);
  if (add <= 0) throw new Error("Payment amount must be positive");
  if (row.status === "on_hold") throw new Error("Release hold before recording a payment");
  const amountPaidPkr = Math.min(row.amountDuePkr, row.amountPaidPkr + add);
  return {
    ...row,
    amountPaidPkr,
    status: derivePaymentStatus(row.amountDuePkr, amountPaidPkr),
    paidOn,
    updatedAt: Date.now(),
  };
}

export type PaymentRegisterSummary = {
  employees: number;
  duePkr: number;
  paidPkr: number;
  remainingPkr: number;
  unpaid: number;
  partial: number;
  paid: number;
  onHold: number;
};

export function summarizePayments(rows: SalaryPaymentRecord[]): PaymentRegisterSummary {
  const s: PaymentRegisterSummary = {
    employees: rows.length,
    duePkr: 0,
    paidPkr: 0,
    remainingPkr: 0,
    unpaid: 0,
    partial: 0,
    paid: 0,
    onHold: 0,
  };
  for (const r of rows) {
    s.duePkr += r.amountDuePkr;
    s.paidPkr += r.amountPaidPkr;
    s.remainingPkr += Math.max(0, r.amountDuePkr - r.amountPaidPkr);
    if (r.status === "unpaid") s.unpaid++;
    else if (r.status === "partial") s.partial++;
    else if (r.status === "paid") s.paid++;
    else s.onHold++;
  }
  return s;
}

/** CSV export — masked account only (last4), never full IBAN. */
export function salaryPaymentsCsv(
  rows: Array<{
    employeeName: string;
    month: string;
    amountDuePkr: number;
    amountPaidPkr: number;
    status: SalaryPaymentStatus;
    institution: string;
    accountLast4: string;
    paidOn: string;
    note: string;
  }>,
): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = [
    "Employee",
    "Month",
    "Amount Due (PKR)",
    "Amount Paid (PKR)",
    "Remaining (PKR)",
    "Status",
    "Institution",
    "Account last4",
    "Paid on",
    "Note",
  ];
  const lines = [
    head.map(esc).join(","),
    ...rows.map((r) =>
      [
        r.employeeName,
        r.month,
        r.amountDuePkr,
        r.amountPaidPkr,
        Math.max(0, r.amountDuePkr - r.amountPaidPkr),
        r.status,
        r.institution,
        r.accountLast4,
        r.paidOn || "",
        r.note,
      ]
        .map(esc)
        .join(","),
    ),
  ];
  return "\ufeff" + lines.join("\n");
}
