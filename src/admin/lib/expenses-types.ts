/** Admin Expenses Management — non-bank operational spend (PKR whole rupees). */

export type ExpenseScope = "one" | "multiple" | "all";

export const EXPENSE_SCOPE_LABEL: Record<ExpenseScope, string> = {
  one: "One employee",
  multiple: "Multiple employees",
  all: "Company / all (single total)",
};

export type ExpenseStatus = "draft" | "submitted" | "approved" | "paid" | "rejected" | "cancelled";

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Built-in categories — custom categories are user-added ids. */
export const BUILTIN_EXPENSE_CATEGORIES = [
  { id: "fuel", name: "Fuel" },
  { id: "office", name: "Office supplies" },
  { id: "travel", name: "Travel" },
  { id: "utilities", name: "Utilities" },
  { id: "maintenance", name: "Maintenance" },
  { id: "meals", name: "Meals / hospitality" },
  { id: "training", name: "Training" },
  { id: "other", name: "Other" },
] as const;

export type ExpenseCategory = {
  id: string;
  name: string;
  custom: boolean;
  archived?: boolean;
};

export type ExpenseRecord = {
  id: string;
  title: string;
  categoryId: string;
  /** Whole PKR — never fractional. Not a salary payment. */
  amountPkr: number;
  /** Expense date (YYYY-MM-DD). */
  expenseDate: string;
  scope: ExpenseScope;
  /**
   * Linked employees for one/multiple. Empty when scope=all.
   * Amount is NEVER auto-split across these IDs — counted once in aggregates.
   */
  employeeIds: string[];
  status: ExpenseStatus;
  note: string;
  /** Soft-delete timestamp; null = active. */
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Optional link to a template this was created from (manual only). */
  templateId: string | null;
};

export type ExpenseTemplate = {
  id: string;
  name: string;
  title: string;
  categoryId: string;
  amountPkr: number;
  scope: ExpenseScope;
  employeeIds: string[];
  note: string;
  /** Cadence hint only — never auto-creates expenses. */
  cadence: "weekly" | "monthly" | "quarterly" | "yearly";
  active: boolean;
  updatedAt: number;
};

export type ExpenseBudget = {
  id: string;
  /** YYYY-MM */
  month: string;
  categoryId: string;
  /** Optional whole-PKR budget cap for the category in that month. */
  limitPkr: number;
  note: string;
};

export type ExpenseAuditEvent = {
  id: string;
  expenseId: string;
  action: string;
  detail: string;
  at: number;
};

export type ExpenseSummary = {
  count: number;
  totalPkr: number;
  byStatus: Record<ExpenseStatus, number>;
  byCategory: Record<string, number>;
  /** Totals that include soft-deleted rows (for audit only). */
  deletedCount: number;
};
