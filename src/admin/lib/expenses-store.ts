/**
 * Admin Expenses store.
 *
 * - Persists to `hr-expenses-v1` (browser) — never app_state / HR_SYNC_KEYS.
 * - No bank/IBAN fields.
 * - Amounts are whole PKR; salary ≠ expense; no auto payroll/OT/deductions.
 * - Soft-delete + restore; audit trail; templates never auto-create.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { assertWholePkr } from "./salary-payments";
import {
  appendAudit,
  defaultExpenseCategories,
  findDuplicateExpense,
  validateExpenseInput,
} from "./expenses-logic";
import { HR_EXPENSES_STORAGE_KEY } from "./expenses-mode";
import type {
  ExpenseAuditEvent,
  ExpenseBudget,
  ExpenseCategory,
  ExpenseRecord,
  ExpenseScope,
  ExpenseStatus,
  ExpenseTemplate,
} from "./expenses-types";

const uid = () => Math.random().toString(36).slice(2, 10);
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asText = (v: unknown): string => (v == null ? "" : typeof v === "string" ? v : String(v));

export type ExpenseUpsertInput = {
  title: string;
  categoryId: string;
  amountPkr: number;
  expenseDate: string;
  scope: ExpenseScope;
  employeeIds: string[];
  status: ExpenseStatus;
  note: string;
  templateId?: string | null;
  /** When true, skip duplicate warning block (caller already confirmed). */
  allowDuplicate?: boolean;
};

type ExpensesState = {
  categories: ExpenseCategory[];
  expenses: ExpenseRecord[];
  templates: ExpenseTemplate[];
  budgets: ExpenseBudget[];
  audit: ExpenseAuditEvent[];

  addCategory: (name: string) => { ok: boolean; error?: string; id?: string };
  archiveCategory: (id: string) => { ok: boolean; error?: string };

  upsertExpense: (
    input: ExpenseUpsertInput,
    opts?: { id?: string },
  ) => { ok: true; id: string } | { ok: false; error: string; duplicateId?: string };
  softDeleteExpense: (id: string) => { ok: boolean; error?: string };
  restoreExpense: (id: string) => { ok: boolean; error?: string };
  setExpenseStatus: (id: string, status: ExpenseStatus) => { ok: boolean; error?: string };

  upsertTemplate: (t: Omit<ExpenseTemplate, "id" | "updatedAt"> & { id?: string }) => { ok: boolean; error?: string; id?: string };
  removeTemplate: (id: string) => void;

  upsertBudget: (b: Omit<ExpenseBudget, "id"> & { id?: string }) => { ok: boolean; error?: string };
  removeBudget: (id: string) => void;

  auditFor: (expenseId: string) => ExpenseAuditEvent[];
};

function seedTemplates(): ExpenseTemplate[] {
  return [
    {
      id: "tpl-office",
      name: "Monthly office supplies",
      title: "Office supplies (monthly)",
      categoryId: "office",
      amountPkr: 15000,
      scope: "all",
      employeeIds: [],
      note: "Template only — create manually from Quick Add",
      cadence: "monthly",
      active: true,
      updatedAt: Date.now(),
    },
  ];
}

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set, get) => ({
      categories: defaultExpenseCategories(),
      expenses: [],
      templates: seedTemplates(),
      budgets: [],
      audit: [],

      addCategory: (name) => {
        const n = asText(name).trim();
        if (!n) return { ok: false, error: "Category name required" };
        const categories = asArr<ExpenseCategory>(get().categories);
        const exists = categories.some(
          (c) => asText(c.name).toLowerCase() === n.toLowerCase() && !c.archived,
        );
        if (exists) return { ok: false, error: "Category already exists" };
        const id = `custom-${uid()}`;
        set({ categories: [...categories, { id, name: n, custom: true }] });
        return { ok: true, id };
      },

      archiveCategory: (id) => {
        const categories = asArr<ExpenseCategory>(get().categories);
        const cat = categories.find((c) => c.id === id);
        if (!cat) return { ok: false, error: "Not found" };
        if (!cat.custom) return { ok: false, error: "Built-in categories cannot be archived" };
        set({
          categories: categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
        });
        return { ok: true };
      },

      upsertExpense: (input, opts) => {
        let amount: number;
        try {
          amount = assertWholePkr(input.amountPkr);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Invalid amount" };
        }
        const check = validateExpenseInput({ ...input, amountPkr: amount });
        if (!check.ok) return check;

        const expenses = asArr<ExpenseRecord>(get().expenses);
        const dup = findDuplicateExpense(expenses, { ...input, amountPkr: amount }, opts?.id);
        if (dup && !input.allowDuplicate) {
          return {
            ok: false,
            error: "Possible duplicate expense (same date, amount, category, people). Confirm to save anyway.",
            duplicateId: dup.id,
          };
        }

        const now = Date.now();
        const title = asText(input.title).trim();
        const note = asText(input.note).trim();
        if (opts?.id) {
          const existing = expenses.find((e) => e.id === opts.id);
          if (!existing) return { ok: false, error: "Expense not found" };
          if (existing.deletedAt) return { ok: false, error: "Restore before editing" };
          set((s) => {
            const list = asArr<ExpenseRecord>(s.expenses);
            return {
              expenses: list.map((e) =>
                e.id === opts.id
                  ? {
                      ...e,
                      title,
                      categoryId: input.categoryId,
                      amountPkr: amount,
                      expenseDate: input.expenseDate,
                      scope: input.scope,
                      employeeIds: input.scope === "all" ? [] : [...asArr<string>(input.employeeIds)],
                      status: input.status,
                      note,
                      templateId: input.templateId ?? e.templateId,
                      updatedAt: now,
                    }
                  : e,
              ),
              audit: appendAudit(asArr(s.audit), opts.id!, "edit", `Updated “${title}” · Rs ${amount}`),
            };
          });
          return { ok: true, id: opts.id };
        }

        const id = uid();
        const row: ExpenseRecord = {
          id,
          title,
          categoryId: input.categoryId,
          amountPkr: amount,
          expenseDate: input.expenseDate,
          scope: input.scope,
          employeeIds: input.scope === "all" ? [] : [...asArr<string>(input.employeeIds)],
          status: input.status,
          note,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          templateId: input.templateId ?? null,
        };
        set((s) => ({
          expenses: [row, ...asArr<ExpenseRecord>(s.expenses)],
          audit: appendAudit(asArr(s.audit), id, "create", `Created “${row.title}” · Rs ${amount}`),
        }));
        return { ok: true, id };
      },

      softDeleteExpense: (id) => {
        const expenses = asArr<ExpenseRecord>(get().expenses);
        const row = expenses.find((e) => e.id === id);
        if (!row) return { ok: false, error: "Not found" };
        if (row.deletedAt) return { ok: false, error: "Already deleted" };
        const now = Date.now();
        set((s) => ({
          expenses: asArr<ExpenseRecord>(s.expenses).map((e) =>
            e.id === id ? { ...e, deletedAt: now, updatedAt: now } : e,
          ),
          audit: appendAudit(asArr(s.audit), id, "soft_delete", `Soft-deleted “${row.title}”`),
        }));
        return { ok: true };
      },

      restoreExpense: (id) => {
        const expenses = asArr<ExpenseRecord>(get().expenses);
        const row = expenses.find((e) => e.id === id);
        if (!row) return { ok: false, error: "Not found" };
        if (!row.deletedAt) return { ok: false, error: "Not deleted" };
        const now = Date.now();
        set((s) => ({
          expenses: asArr<ExpenseRecord>(s.expenses).map((e) =>
            e.id === id ? { ...e, deletedAt: null, updatedAt: now } : e,
          ),
          audit: appendAudit(asArr(s.audit), id, "restore", `Restored “${row.title}”`),
        }));
        return { ok: true };
      },

      setExpenseStatus: (id, status) => {
        const expenses = asArr<ExpenseRecord>(get().expenses);
        const row = expenses.find((e) => e.id === id);
        if (!row || row.deletedAt) return { ok: false, error: "Not found" };
        set((s) => ({
          expenses: asArr<ExpenseRecord>(s.expenses).map((e) =>
            e.id === id ? { ...e, status, updatedAt: Date.now() } : e,
          ),
          audit: appendAudit(asArr(s.audit), id, "status", `${row.status} → ${status}`),
        }));
        return { ok: true };
      },

      upsertTemplate: (t) => {
        try {
          assertWholePkr(t.amountPkr);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Invalid amount" };
        }
        const tName = asText(t.name).trim();
        const tTitle = asText(t.title).trim();
        if (!tName || !tTitle) return { ok: false, error: "Name and title required" };
        const check = validateExpenseInput({
          title: tTitle,
          categoryId: t.categoryId,
          amountPkr: t.amountPkr,
          expenseDate: "2000-01-01",
          scope: t.scope,
          employeeIds: t.employeeIds,
        });
        if (!check.ok) return check;
        const now = Date.now();
        if (t.id) {
          set((s) => ({
            templates: asArr<ExpenseTemplate>(s.templates).map((x) =>
              x.id === t.id
                ? {
                    ...x,
                    ...t,
                    name: tName,
                    title: tTitle,
                    note: asText(t.note),
                    employeeIds: t.scope === "all" ? [] : [...asArr<string>(t.employeeIds)],
                    updatedAt: now,
                  }
                : x,
            ),
          }));
          return { ok: true, id: t.id };
        }
        const id = uid();
        set((s) => ({
          templates: [
            {
              id,
              name: tName,
              title: tTitle,
              categoryId: t.categoryId,
              amountPkr: t.amountPkr,
              scope: t.scope,
              employeeIds: t.scope === "all" ? [] : [...asArr<string>(t.employeeIds)],
              note: asText(t.note),
              cadence: t.cadence,
              active: t.active,
              updatedAt: now,
            },
            ...asArr<ExpenseTemplate>(s.templates),
          ],
        }));
        return { ok: true, id };
      },

      removeTemplate: (id) =>
        set((s) => ({ templates: asArr<ExpenseTemplate>(s.templates).filter((t) => t.id !== id) })),

      upsertBudget: (b) => {
        try {
          assertWholePkr(b.limitPkr);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Invalid limit" };
        }
        if (!/^\d{4}-\d{2}$/.test(b.month)) return { ok: false, error: "Month must be YYYY-MM" };
        const budgets = asArr<ExpenseBudget>(get().budgets);
        if (b.id) {
          set({
            budgets: budgets.map((x) => (x.id === b.id ? { ...x, ...b, limitPkr: b.limitPkr } : x)),
          });
          return { ok: true };
        }
        const clash = budgets.find((x) => x.month === b.month && x.categoryId === b.categoryId);
        if (clash) {
          set({
            budgets: budgets.map((x) =>
              x.id === clash.id ? { ...x, limitPkr: b.limitPkr, note: b.note } : x,
            ),
          });
          return { ok: true };
        }
        set({
          budgets: [
            ...budgets,
            { id: uid(), month: b.month, categoryId: b.categoryId, limitPkr: b.limitPkr, note: b.note },
          ],
        });
        return { ok: true };
      },

      removeBudget: (id) =>
        set((s) => ({ budgets: asArr<ExpenseBudget>(s.budgets).filter((b) => b.id !== id) })),

      auditFor: (expenseId) => asArr<ExpenseAuditEvent>(get().audit).filter((a) => a.expenseId === expenseId),
    }),
    {
      name: HR_EXPENSES_STORAGE_KEY,
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? (persisted as Partial<ExpensesState>)
            : {};
        const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
        const healExpense = (e: ExpenseRecord): ExpenseRecord => ({
          ...e,
          title: asText(e.title),
          expenseDate: asText(e.expenseDate),
          note: asText(e.note),
          categoryId: asText(e.categoryId),
          employeeIds: Array.isArray(e.employeeIds) ? e.employeeIds.map(asText) : [],
        });
        const healTemplate = (t: ExpenseTemplate): ExpenseTemplate => ({
          ...t,
          name: asText(t.name),
          title: asText(t.title),
          note: asText(t.note),
          categoryId: asText(t.categoryId),
          employeeIds: Array.isArray(t.employeeIds) ? t.employeeIds.map(asText) : [],
        });
        const healCategory = (c: ExpenseCategory): ExpenseCategory => ({
          ...c,
          id: asText(c.id),
          name: asText(c.name),
        });
        const healBudget = (b: ExpenseBudget): ExpenseBudget => ({
          ...b,
          id: asText(b.id),
          month: asText(b.month),
          categoryId: asText(b.categoryId),
          note: asText(b.note),
        });
        const healAudit = (a: ExpenseAuditEvent): ExpenseAuditEvent => ({
          ...a,
          id: asText(a.id),
          expenseId: asText(a.expenseId),
          action: asText(a.action),
          detail: asText(a.detail),
        });
        return {
          ...current,
          ...raw,
          categories: arr(raw.categories, current.categories).map(healCategory),
          expenses: arr(raw.expenses, current.expenses).map(healExpense),
          templates: arr(raw.templates, current.templates).map(healTemplate),
          budgets: arr(raw.budgets, current.budgets).map(healBudget),
          audit: arr(raw.audit, current.audit).map(healAudit),
        };
      },
    },
  ),
);
