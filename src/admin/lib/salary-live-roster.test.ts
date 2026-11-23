import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Prod Salary pay must not hard-render Ayesha/Bilal/Camila/Danish MOCK seeds.
 * Synthetic roster stays behind shouldShowFinanceMockUi (preview / VITE_SHOW_FINANCE_MOCK).
 */
describe("Salary pay live Team roster (no MOCK seeds in Prod UI)", () => {
  it("SalaryPayments due roster uses live Team when mock chrome is off", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/SalaryPayments.tsx"),
      "utf8",
    );
    expect(src).toMatch(/dueRoster/);
    expect(src).toMatch(/shouldShowFinanceMockUi/);
    expect(src).toMatch(/Update due amounts \(live Team\)/);
    // Must not always map SYNTHETIC_EMPLOYEES into the due list.
    expect(src).not.toMatch(/\{\[\.\.\.SYNTHETIC_EMPLOYEES\]\.map/);
    expect(src).toMatch(/if \(showMockUi\) return \[\.\.\.SYNTHETIC_EMPLOYEES\]/);
  });

  it("PayrollVerify and Expenses gate synthetic names behind showMockUi", () => {
    const payroll = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/PayrollVerify.tsx"),
      "utf8",
    );
    const expenses = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(payroll).toMatch(/if \(showMockUi\)/);
    expect(expenses).toMatch(/if \(showMockUi\)/);
  });
});
