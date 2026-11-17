import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { academicTodos, feeTodos, slotsForDate } from "@/personal/lib/vu-plan";
import { appendAudit, findDuplicateExpense } from "@/admin/lib/expenses-logic";
import { useExpensesStore } from "@/admin/lib/expenses-store";

describe("Dispatch ops list / VU plan / expenses mutation guards", () => {
  it("LoadEditor and TeamBoard coerce list API results before setState", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/setCalls\(Array\.isArray\(c\)/);
    expect(src).toMatch(/setComms\(Array\.isArray\(com\)/);
    expect(src).toMatch(/setAccessorials\(Array\.isArray\(acc\)/);
    expect(src).toMatch(/setRows\(Array\.isArray\(next\) \? next : \[\]\)/);
  });

  it("VU plan helpers tolerate missing todos/slots arrays", () => {
    expect(academicTodos({ todos: null } as unknown as never)).toEqual([]);
    expect(feeTodos({ todos: "x" } as unknown as never)).toEqual([]);
    expect(
      slotsForDate(
        { weeklyLectureSchedule: { slots: null } } as unknown as never,
        "2026-11-17",
      ),
    ).toEqual([]);
  });

  it("expenses findDuplicate/appendAudit and store mutations heal non-arrays", () => {
    expect(findDuplicateExpense(null as unknown as [], {
      title: "t",
      categoryId: "office",
      amountPkr: 1,
      expenseDate: "2026-11-01",
      scope: "all",
      employeeIds: [],
    })).toBeUndefined();
    expect(appendAudit(null as unknown as [], "e1", "create", "x")).toHaveLength(1);
    useExpensesStore.setState({
      categories: null as unknown as [],
      expenses: "bad" as unknown as [],
      templates: undefined as unknown as [],
      budgets: null as unknown as [],
      audit: null as unknown as [],
    });
    expect(useExpensesStore.getState().addCategory("Guard Cat").ok).toBe(true);
    expect(Array.isArray(useExpensesStore.getState().categories)).toBe(true);
    expect(useExpensesStore.getState().auditFor("missing")).toEqual([]);
  });

  it("upsertExpense/upsertTemplate coerce non-array employeeIds before spread", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/expenses-store.ts"), "utf8");
    expect(src).toMatch(/\[\.\.\.asArr<string>\(input\.employeeIds\)\]/);
    expect(src).toMatch(/\[\.\.\.asArr<string>\(t\.employeeIds\)\]/);
    const ui = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(ui).toMatch(/Array\.isArray\(draft\.employeeIds\)\s*\?\s*draft\.employeeIds\s*:\s*\[\]/);
    useExpensesStore.setState({
      categories: [{ id: "office", name: "Office", custom: false }],
      expenses: [],
      templates: [],
      budgets: [],
      audit: [],
    });
    expect(() =>
      useExpensesStore.getState().upsertExpense({
        title: "Office supplies",
        categoryId: "office",
        amountPkr: 500,
        expenseDate: "2026-11-17",
        scope: "all",
        employeeIds: null as unknown as string[],
        status: "draft",
        note: "",
        allowDuplicate: true,
      }),
    ).not.toThrow();
    const row = useExpensesStore.getState().expenses[0];
    expect(Array.isArray(row?.employeeIds)).toBe(true);
    expect(row?.employeeIds).toEqual([]);
    expect(() =>
      useExpensesStore.getState().upsertTemplate({
        name: "Monthly office",
        title: "Office supplies",
        categoryId: "office",
        amountPkr: 500,
        scope: "all",
        employeeIds: null as unknown as string[],
        note: "",
        cadence: "monthly",
        active: true,
      }),
    ).not.toThrow();
    expect(Array.isArray(useExpensesStore.getState().templates[0]?.employeeIds)).toBe(true);
  });
});
