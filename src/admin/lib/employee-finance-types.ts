/** Employment lifecycle for directory (separate from attendance day Status). */
export type EmploymentStatus = "active" | "inactive" | "leave";

export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  leave: "On leave",
};

/**
 * One banking / wallet destination. Changes create a new row (history);
 * prior rows are superseded — never overwritten.
 */
export type BankingAccountRecord = {
  id: string;
  employeeId: string;
  institutionId: string;
  otherLabel?: string;
  accountTitle: string;
  /** Full IBAN / wallet identifier — MOCK MEMORY ONLY. Never write to localStorage/app_state. */
  accountRef: string;
  isIban: boolean;
  effectiveFrom: string; // ISO date YYYY-MM-DD
  supersededAt: string | null;
  note: string;
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
  /** Snapshot of which banking row was used (history-safe). */
  bankingAccountId: string | null;
  paidOn: string | null; // YYYY-MM-DD
  note: string;
  updatedAt: number;
};

export type EmployeeDirectoryMeta = {
  employeeId: string;
  status: EmploymentStatus;
  deactivatedAt: string | null;
  reactivatedAt: string | null;
};
