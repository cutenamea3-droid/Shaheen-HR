import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("HireDate / Vault / Tasks / Payroll / stops autofill", () => {
  it("HireDateField commits from DOM refs", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/HireDateField.tsx"),
      "utf8",
    );
    expect(src).toMatch(/typedRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="hire-date-typed"/);
  });

  it("Personal Vault password change reads DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Vault.tsx"), "utf8");
    expect(src).toMatch(/pwRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-vault-password"/);
  });

  it("Admin Tasks and PayrollVerify read DOM drafts", () => {
    const tasks = readFileSync(resolve(process.cwd(), "src/admin/components/hr/Tasks.tsx"), "utf8");
    const pay = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/PayrollVerify.tsx"),
      "utf8",
    );
    expect(tasks).toMatch(/titleRef\.current\?\.value/);
    expect(pay).toMatch(/dayRateRef\.current\?\.value/);
    expect(pay).toMatch(/data-testid="admin-day-rate"/);
  });

  it("Dispatch stop fields update on input", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/onInput=\{\(e\) => setStop\(i, \{ name:/);
    expect(src).toMatch(/onInput=\{\(e\) => setStop\(i, \{ address:/);
  });
});
