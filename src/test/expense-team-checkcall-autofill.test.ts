import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Expense / Team / check-call autofill", () => {
  it("ExpensesManagement note + custom category use onInput", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-testid="admin-expense-note"/);
    expect(src).toMatch(/onInput=\{\(e\) => setForm\(\(f\) => \(\{ \.\.\.f, note:/);
    expect(src).toMatch(/data-testid="admin-custom-category"/);
    expect(src).toMatch(/new FormData\(e\.currentTarget\)/);
  });

  it("Admin Team employee name uses onInput", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/components/hr/Team.tsx"), "utf8");
    expect(src).toMatch(/onInput=\{\(ev\) => updateEmployee\(e\.id, \{ name:/);
  });

  it("Dispatch check-call location/notes use onInput + DOM read", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/dispatch-check-location-\$\{load\.id\}/);
    expect(src).toMatch(/dispatch-check-notes-\$\{load\.id\}/);
    expect(src).toMatch(/document\.querySelector<HTMLInputElement>/);
  });

  it("EmployeeDirectory bank note uses onInput", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-testid="admin-bank-note"/);
    expect(src).toMatch(/onInput=\{\(e\) => setForm\(\(f\) => \(\{ \.\.\.f, note:/);
  });
});
