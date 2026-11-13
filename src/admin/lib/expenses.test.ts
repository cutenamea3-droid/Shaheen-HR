import { describe, expect, it } from "vitest";
import { HR_SYNC_KEYS } from "./hr-sync-protect";
import {
  employeeExpenseTotal,
  findDuplicateExpense,
  summarizeExpenses,
  validateExpenseInput,
} from "./expenses-logic";
import { HR_EXPENSES_STORAGE_KEY } from "./expenses-mode";
import { expensesCsv, toExpenseExportRows } from "./expenses-reports";
import type { ExpenseRecord } from "./expenses-types";
import { tenureFromJoiningDate } from "./employee-finance-types";

const base = (over: Partial<ExpenseRecord>): ExpenseRecord => ({
  id: "e1",
  title: "Fuel run",
  categoryId: "fuel",
  amountPkr: 10000,
  expenseDate: "2026-11-05",
  scope: "one",
  employeeIds: ["a"],
  status: "approved",
  note: "",
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
  templateId: null,
  ...over,
});

describe("expenses — whole PKR + scopes", () => {
  it("rejects fractional PKR and all-scope with employee ids", () => {
    expect(validateExpenseInput({
      title: "x",
      categoryId: "fuel",
      amountPkr: 10.5,
      expenseDate: "2026-11-01",
      scope: "one",
      employeeIds: ["a"],
    }).ok).toBe(false);

    expect(
      validateExpenseInput({
        title: "Company rent",
        categoryId: "utilities",
        amountPkr: 50000,
        expenseDate: "2026-11-01",
        scope: "all",
        employeeIds: ["a", "b"],
      }).ok,
    ).toBe(false);
  });

  it("never double-counts: amount once even with multiple employees", () => {
    const rows = [
      base({ id: "1", scope: "multiple", employeeIds: ["a", "b"], amountPkr: 30000 }),
      base({ id: "2", scope: "all", employeeIds: [], amountPkr: 100000, title: "Rent" }),
      base({ id: "3", scope: "one", employeeIds: ["a"], amountPkr: 5000 }),
    ];
    const s = summarizeExpenses(rows);
    expect(s.totalPkr).toBe(135000);
    expect(s.count).toBe(3);
    // Personal total excludes company-wide
    expect(employeeExpenseTotal(rows, "a")).toBe(35000);
    expect(employeeExpenseTotal(rows, "b")).toBe(30000);
  });

  it("detects duplicates", () => {
    const rows = [base({})];
    expect(findDuplicateExpense(rows, base({}))?.id).toBe("e1");
    expect(findDuplicateExpense(rows, base({ amountPkr: 999 }))).toBeUndefined();
  });
});

describe("expenses storage isolation", () => {
  it("uses a dedicated key never in HR_SYNC_KEYS", () => {
    expect(HR_EXPENSES_STORAGE_KEY).toBe("hr-expenses-v1");
    expect(HR_SYNC_KEYS).not.toContain("expenses" as never);
    expect(HR_SYNC_KEYS).not.toContain("hr-expenses-v1" as never);
    expect([...HR_SYNC_KEYS]).toEqual(["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"]);
  });
});

describe("expenses CSV — no bank fields", () => {
  it("exports without IBAN columns", () => {
    const csv = expensesCsv(
      toExpenseExportRows(
        [base({ scope: "all", employeeIds: [] })],
        [{ id: "fuel", name: "Fuel", custom: false }],
        new Map([["a", "Ayesha"]]),
      ),
    );
    const lower = csv.toLowerCase();
    expect(lower).not.toContain("iban");
    expect(lower).not.toMatch(/\baccount\b/);
    expect(lower).toContain("company total");
  });
});

describe("joining tenure helper", () => {
  it("formats date-only tenure", () => {
    const t = tenureFromJoiningDate("2024-02-01", new Date("2026-11-13"));
    expect(t).not.toBeNull();
    expect(t!.years).toBeGreaterThanOrEqual(2);
    expect(t!.label).toMatch(/\d+y/);
  });
});
