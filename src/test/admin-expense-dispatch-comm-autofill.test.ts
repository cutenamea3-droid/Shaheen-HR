import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Admin expense + Dispatch comm autofill", () => {
  it("reads expense title/amount from DOM on save", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(src).toMatch(/titleRef\.current\?\.value/);
    expect(src).toMatch(/amountRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="admin-expense-title"/);
  });

  it("reads communication summary/detail/decision from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/commSummaryRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-comm-summary"/);
    expect(src).toMatch(/summary: nextSummary/);
  });
});
