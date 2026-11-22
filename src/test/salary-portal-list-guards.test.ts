import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { salaryPaymentsCsv, summarizePayments } from "@/admin/lib/salary-payments";

describe("salary + portal list Array.isArray guards", () => {
  it("summarizePayments / salaryPaymentsCsv tolerate non-array rows", () => {
    expect(summarizePayments(null as never).employees).toBe(0);
    expect(salaryPaymentsCsv("bad" as never)).toContain('"Employee"');
  });

  it("portal-local listAccounts/Activity coerce with Array.isArray", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/portal-local.ts"), "utf8");
    expect(src).toMatch(/if \(!Array\.isArray\(raw\)\) return \[\]/);
    expect(src).toMatch(/portalEmailKey\(\(a as PortalAccount\)\.email\)/);
    expect(src).toMatch(/Array\.isArray\(raw\) \? \(raw as LocalActivity\[\]\) : \[\]/);
  });

  it("SalaryPayments UI coerces payments/banking; paymentEvents stays store fn", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/SalaryPayments.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const payments = Array\.isArray\(paymentsRaw\)/);
    expect(src).toMatch(/const banking = Array\.isArray\(bankingRaw\)/);
    expect(src).toMatch(/const paymentEvents = useEmployeeFinanceMock\(\(s\) => s\.paymentEvents\)/);
    expect(src).not.toMatch(/Array\.isArray\(paymentEventsRaw\)/);
  });

  it("PayrollVerify coerces payments/bonuses arrays and approvals object", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/PayrollVerify.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const payments = Array\.isArray\(paymentsRaw\)/);
    expect(src).toMatch(/const bonuses = Array\.isArray\(bonusesRaw\)/);
    expect(src).toMatch(/approvalsRaw && typeof approvalsRaw === "object" && !Array\.isArray\(approvalsRaw\)/);
  });

  it("Overtime UI coerces OT approval rowsMap object", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/components/hr/Overtime.tsx"), "utf8");
    expect(src).toMatch(/rowsMapRaw && typeof rowsMapRaw === "object" && !Array\.isArray\(rowsMapRaw\)/);
  });
});
