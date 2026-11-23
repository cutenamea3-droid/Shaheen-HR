import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expensesModeLabel } from "./expenses-mode";

describe("Expenses mode banner (SHRP-140)", () => {
  it("labels are short and jargon-free", () => {
    expect(expensesModeLabel("local")).toBe("Saved on this device");
    expect(expensesModeLabel("secure")).toBe("Cloud expenses");
    expect(expensesModeLabel("local")).not.toMatch(/PR #19|app_state|Browser-local/);
  });

  it("ExpensesManagement hides orange Mode banner in live/local mode", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/Attendance cloud sync \(PR #19\)/);
    expect(src).not.toMatch(/warn-soft.*Mode:/);
    expect(src).toMatch(/mode === "secure"/);
    expect(src).toMatch(/Your expense records sync with Admin cloud/);
  });
});
