import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Records + Dispatch ops + Admin bank/pay autofill", () => {
  it("Records add reads person/doc from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/Records.tsx"), "utf8");
    expect(src).toMatch(/nameRef\.current\?\.value/);
    expect(src).toMatch(/docRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="records-person-name"/);
  });

  it("Dispatch check-call and exception read DOM fallbacks", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/checkNotesRef\.current\?\.value/);
    expect(src).toMatch(/excKindRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-check-notes"/);
  });

  it("Admin banking + salary amount survive autofill", () => {
    const bank = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    const pay = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/SalaryPayments.tsx"),
      "utf8",
    );
    expect(bank).toMatch(/accountTitleRef\.current\?\.value/);
    expect(bank).toMatch(/accountRefRef\.current\?\.value/);
    expect(pay).toMatch(/onInput=\{\(e\) =>/);
    expect(pay).toMatch(/previousElementSibling/);
  });
});
