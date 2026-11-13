/** Employment lifecycle for directory (separate from attendance day Status). */
export type EmploymentStatus = "active" | "inactive" | "leave";

export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  leave: "On leave",
};

/**
 * Masked banking row — safe for UI lists / export.
 * Full accountRef exists only after audited reveal (session memory), never in localStorage.
 */
export type BankingAccountMasked = {
  id: string;
  employeeId: string;
  /** Provider / institution id from PK directory (or other). */
  institutionId: string;
  otherLabel?: string;
  /** Account holder name */
  accountTitle: string;
  accountLast4: string;
  isIban: boolean;
  effectiveFrom: string;
  supersededAt: string | null;
  note: string;
};

/**
 * @deprecated Prefer BankingAccountMasked + revealAccount().
 * Mock-only full ref retained for Phase A compatibility in tests.
 */
export type BankingAccountRecord = BankingAccountMasked & {
  /** Full IBAN / wallet — MOCK MEMORY ONLY. */
  accountRef: string;
};

export type SalaryPaymentStatus = "unpaid" | "partial" | "paid" | "on_hold";

export const SALARY_PAYMENT_STATUS_LABEL: Record<SalaryPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  on_hold: "On hold",
};

/**
 * Monthly salary payment register entry (PKR whole numbers).
 * Status is ALWAYS manual — never auto-set from payroll hours CSV.
 */
export type SalaryPaymentRecord = {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  amountDuePkr: number;
  amountPaidPkr: number;
  status: SalaryPaymentStatus;
  bankingAccountId: string | null;
  paidOn: string | null;
  note: string;
  updatedAt: number;
};

export type SalaryPaymentEvent = {
  id: string;
  paymentId: string;
  eventType: "due_set" | "partial_pay" | "status_change" | "note";
  amountPkr: number | null;
  statusAfter: string | null;
  note: string;
  createdAt: number;
};

export type EmployeeDirectoryMeta = {
  employeeId: string;
  status: EmploymentStatus;
  /** Joining date for finance records (YYYY-MM-DD); independent of attendance joinMonth. */
  joiningDate: string | null;
  /** Optional job title — finance roster only; does not overwrite Team employee rows. */
  designation?: string | null;
  deactivatedAt: string | null;
  reactivatedAt: string | null;
};

/** Bank profile completeness for directory badges (masked presence only). */
export type BankProfileCompleteness = "complete" | "missing";

export const BANK_PROFILE_LABEL: Record<BankProfileCompleteness, string> = {
  complete: "Complete",
  missing: "Missing",
};

/** Date-only tenure from joining date (YYYY-MM-DD) to `asOf` (default today). */
export function tenureFromJoiningDate(
  joiningDate: string | null | undefined,
  asOf = new Date(),
): { years: number; months: number; label: string } | null {
  if (!joiningDate || !/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) return null;
  const [y, m, d] = joiningDate.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!);
  if (Number.isNaN(start.getTime()) || start > asOf) return null;
  let months =
    (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (rem > 0 || years === 0) parts.push(`${rem}mo`);
  return { years, months: rem, label: parts.join(" ") };
}
