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
});
