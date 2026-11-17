import { describe, expect, it } from "vitest";
import { buildSeed, type AppData } from "@/lib/sections";
import { buildComplianceHistory } from "@/lib/compliance-history";
import { migrateDiscipline } from "@/personal/lib/defaults";
import { usePersonal } from "@/personal/lib/store";
import {
  summarizeExpenses,
  findDuplicateExpense,
  templateToExpenseDraft,
} from "@/admin/lib/expenses-logic";
import type { ExpenseRecord } from "@/admin/lib/expenses-types";
import {
  awaitingBolLoads,
  dueFollowUps,
  buildEquipmentBoard,
  renumberStops,
  removeStop,
} from "@/dispatch/lib/ops-controls";

describe("expenses / discipline / ops corrupt guards", () => {
  it("rosterHistory corrupt does not crash compliance history", () => {
    const data = structuredClone(buildSeed()) as AppData;
    const id = data.sections.dmv.rows[0]!.driverId;
    data.sections.dmv.rows[0] = {
      ...data.sections.dmv.rows[0]!,
      rosterHistory: { bad: true } as unknown as [],
      addedAt: Date.now(),
    };
    expect(() => buildComplianceHistory(data, { driverId: id, limit: 20 })).not.toThrow();
  });

  it("migrateDiscipline + toggleDiscipline coerce doneDates", () => {
    const migrated = migrateDiscipline([
      { id: "open-vulms", label: "x", doneDates: null as unknown as string[] },
      { id: "custom-x", label: "Custom", doneDates: "nope" as unknown as string[] },
    ] as never);
    expect(migrated.every((d) => Array.isArray(d.doneDates))).toBe(true);
    usePersonal.setState({
      discipline: [{ id: "open-vulms", label: "Opened", doneDates: null as unknown as string[] }],
    });
    expect(() => usePersonal.getState().toggleDiscipline("open-vulms", "2026-11-17")).not.toThrow();
    expect(usePersonal.getState().discipline[0]!.doneDates).toContain("2026-11-17");
  });

  it("summarizeExpenses tolerates non-array rows", () => {
    expect(() => summarizeExpenses(null as unknown as ExpenseRecord[])).not.toThrow();
    expect(summarizeExpenses(null as unknown as ExpenseRecord[]).count).toBe(0);
  });

  it("expense employeeIds coerce in summarize/duplicate/template", () => {
    const row = {
      id: "1",
      title: "Taxi",
      categoryId: "travel",
      amountPkr: 1000,
      expenseDate: "2026-11-01",
      scope: "one",
      employeeIds: null,
      status: "approved",
      note: "",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      templateId: null,
    } as unknown as ExpenseRecord;
    expect(() => summarizeExpenses([row], { employeeId: "a" })).not.toThrow();
    expect(() =>
      findDuplicateExpense([row], {
        title: "Taxi",
        categoryId: "travel",
        amountPkr: 1000,
        expenseDate: "2026-11-01",
        scope: "one",
        employeeIds: null as unknown as string[],
      }),
    ).not.toThrow();
    const draft = templateToExpenseDraft(
      {
        id: "t1",
        name: "T",
        title: "T",
        categoryId: "office",
        amountPkr: 1,
        scope: "one",
        employeeIds: null as unknown as string[],
        note: "",
        cadence: "monthly",
        active: true,
        updatedAt: 1,
      },
      "2026-11-01",
    );
    expect(draft.employeeIds).toEqual([]);
  });

  it("Dispatch ops helpers tolerate missing arrays", () => {
    expect(awaitingBolLoads(null as unknown as [])).toEqual([]);
    expect(dueFollowUps(undefined as unknown as [])).toEqual([]);
    expect(buildEquipmentBoard(null as unknown as [], { bad: true } as unknown as [])).toEqual([]);
    expect(renumberStops(null as unknown as [])).toEqual([]);
    expect(removeStop(null as unknown as [], 0)).toEqual([]);
  });
});
