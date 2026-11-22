import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { budgetUsage, summarizeExpenses } from "@/admin/lib/expenses-logic";

describe("expenseDate startsWith + Admin account email coerce", () => {
  it("summarizeExpenses / budgetUsage tolerate non-string expenseDate", () => {
    const rows = [
      {
        id: "e1",
        title: "Fuel",
        categoryId: "fuel",
        amountPkr: 100,
        expenseDate: 20261101 as unknown as string,
        scope: "all" as const,
        employeeIds: [],
        status: "approved" as const,
        note: "",
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        templateId: null,
      },
    ];
    expect(() => summarizeExpenses(rows, { month: "2026-11" })).not.toThrow();
    expect(() => budgetUsage([], rows, "2026-11", "fuel")).not.toThrow();
  });

  it("ExpensesManagement and store heal coerce expenseDate before startsWith", () => {
    const ui = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(ui).toMatch(/asText\(e\.expenseDate\)\.startsWith/);
    expect(ui).not.toMatch(/!e\.expenseDate\.startsWith\(month\)/);
    const store = readFileSync(resolve(process.cwd(), "src/admin/lib/expenses-store.ts"), "utf8");
    expect(store).toMatch(/expenseDate: asText\(e\.expenseDate\)/);
  });

  it("MyAccount / TeamManagement coerce email before slice/toLowerCase", () => {
    const acct = readFileSync(resolve(process.cwd(), "src/admin/components/hr/MyAccount.tsx"), "utf8");
    expect(acct).toMatch(/const emailKey =/);
    expect(acct).toMatch(/emailKey\.toLowerCase\(\)/);
    expect(acct).not.toMatch(/email\.trim\(\)\.toLowerCase\(\)/);
    const team = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/TeamManagement.tsx"),
      "utf8",
    );
    expect(team).toMatch(/asMail\(m\.email\) === mail/);
    expect(team).not.toMatch(/adminEmail\.toLowerCase\(\)/);
  });
});
