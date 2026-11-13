import { assertWholePkr } from "./salary-payments";
import type {
  ExpenseAuditEvent,
  ExpenseBudget,
  ExpenseRecord,
  ExpenseScope,
  ExpenseStatus,
  ExpenseSummary,
  ExpenseTemplate,
} from "./expenses-types";
import { BUILTIN_EXPENSE_CATEGORIES } from "./expenses-types";

export function defaultExpenseCategories() {
  return BUILTIN_EXPENSE_CATEGORIES.map((c) => ({ id: c.id, name: c.name, custom: false }));
}

/** Salary / payroll words — expenses must never double-count salary payments. */
const SALARY_LIKE = /\b(salary|salaries|payroll|wage|wages|basic\s*pay)\b/i;

export function looksLikeSalaryExpense(title: string, categoryId: string, categoryName?: string): boolean {
  if (SALARY_LIKE.test(title)) return true;
  if (SALARY_LIKE.test(categoryId)) return true;
  if (categoryName && SALARY_LIKE.test(categoryName)) return true;
  return false;
}

export function validateExpenseInput(input: {
  title: string;
  categoryId: string;
  amountPkr: number;
  expenseDate: string;
  scope: ExpenseScope;
  employeeIds: string[];
  categoryName?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.title.trim()) return { ok: false, error: "Title is required" };
  if (!input.categoryId) return { ok: false, error: "Category is required" };
  if (looksLikeSalaryExpense(input.title, input.categoryId, input.categoryName)) {
    return {
      ok: false,
      error: "Salary / payroll belongs on Salary pay — do not record it as an expense (avoids double-count)",
    };
  }
  try {
    assertWholePkr(input.amountPkr);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid amount" };
  }
  if (input.amountPkr <= 0) return { ok: false, error: "Amount must be a positive whole PKR amount" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) return { ok: false, error: "Expense date must be YYYY-MM-DD" };
  if (input.scope === "one" && input.employeeIds.length !== 1) {
    return { ok: false, error: "One-employee scope requires exactly one employee" };
  }
  if (input.scope === "multiple" && input.employeeIds.length < 2) {
    return { ok: false, error: "Multiple scope requires at least two employees" };
  }
  if (input.scope === "all" && input.employeeIds.length > 0) {
    return { ok: false, error: "Company / all scope must not list individual employees (avoids double-count)" };
  }
  return { ok: true };
}

/**
 * Aggregate totals — each expense amount counted ONCE regardless of employeeIds length.
 * Never auto-splits company (scope=all) totals across the roster.
 */
export function summarizeExpenses(
  rows: ExpenseRecord[],
  opts?: { includeDeleted?: boolean; month?: string; employeeId?: string },
): ExpenseSummary {
  const byStatus = {
    draft: 0,
    submitted: 0,
    approved: 0,
    paid: 0,
    rejected: 0,
    cancelled: 0,
  } as Record<ExpenseStatus, number>;
  const byCategory: Record<string, number> = {};
  let totalPkr = 0;
  let count = 0;
  let deletedCount = 0;

  for (const r of rows) {
    if (r.deletedAt) {
      deletedCount++;
      if (!opts?.includeDeleted) continue;
    }
    if (opts?.month && !r.expenseDate.startsWith(opts.month)) continue;
    if (opts?.employeeId) {
      if (r.scope === "all") continue; // company totals are not attributed per employee
      if (!r.employeeIds.includes(opts.employeeId)) continue;
    }
    count++;
    totalPkr += r.amountPkr;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byCategory[r.categoryId] = (byCategory[r.categoryId] ?? 0) + r.amountPkr;
  }

  return { count, totalPkr, byStatus, byCategory, deletedCount };
}

/**
 * Employee financial expense slice — only one/multiple scoped rows that include the employee.
 * Company-wide (all) expenses are excluded so they are never double-counted into personal totals.
 */
export function employeeExpenseTotal(rows: ExpenseRecord[], employeeId: string, month?: string): number {
  return summarizeExpenses(rows, month != null ? { employeeId, month } : { employeeId }).totalPkr;
}

/** Warn when an active expense looks like a duplicate (same day, amount, category, scope set). */
export function findDuplicateExpense(
  rows: ExpenseRecord[],
  candidate: Pick<ExpenseRecord, "title" | "categoryId" | "amountPkr" | "expenseDate" | "scope" | "employeeIds">,
  excludeId?: string,
): ExpenseRecord | undefined {
  const ids = [...candidate.employeeIds].sort().join(",");
  return rows.find((r) => {
    if (r.deletedAt) return false;
    if (excludeId && r.id === excludeId) return false;
    if (r.expenseDate !== candidate.expenseDate) return false;
    if (r.categoryId !== candidate.categoryId) return false;
    if (r.amountPkr !== candidate.amountPkr) return false;
    if (r.scope !== candidate.scope) return false;
    if ([...r.employeeIds].sort().join(",") !== ids) return false;
    // Same title OR empty titles both count as duplicate signal
    return r.title.trim().toLowerCase() === candidate.title.trim().toLowerCase();
  });
}

export function budgetUsage(
  budgets: ExpenseBudget[],
  expenses: ExpenseRecord[],
  month: string,
  categoryId: string,
): { limitPkr: number | null; spentPkr: number; over: boolean } {
  const budget = budgets.find((b) => b.month === month && b.categoryId === categoryId);
  const spentPkr = expenses
    .filter((e) => !e.deletedAt && e.expenseDate.startsWith(month) && e.categoryId === categoryId)
    .reduce((s, e) => s + e.amountPkr, 0);
  const limitPkr = budget?.limitPkr ?? null;
  return { limitPkr, spentPkr, over: limitPkr != null && spentPkr > limitPkr };
}

export function templateToExpenseDraft(t: ExpenseTemplate, expenseDate: string): Omit<
  ExpenseRecord,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "status"
> & { status: ExpenseStatus } {
  return {
    title: t.title,
    categoryId: t.categoryId,
    amountPkr: t.amountPkr,
    expenseDate,
    scope: t.scope,
    employeeIds: [...t.employeeIds],
    status: "draft",
    note: t.note,
    templateId: t.id,
  };
}

export function appendAudit(
  events: ExpenseAuditEvent[],
  expenseId: string,
  action: string,
  detail: string,
): ExpenseAuditEvent[] {
  return [
    {
      id: Math.random().toString(36).slice(2, 10),
      expenseId,
      action,
      detail,
      at: Date.now(),
    },
    ...events,
  ].slice(0, 1000);
}
