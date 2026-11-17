import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Admin due/month slice coerce guards", () => {
  it("payroll CSV + monthLabel + reminder/follow-up audit months coerce before slice/split", () => {
    const payroll = readFileSync(resolve(process.cwd(), "src/admin/lib/reports.ts"), "utf8");
    const model = readFileSync(
      resolve(process.cwd(), "src/admin/lib/monthly-report-model.ts"),
      "utf8",
    );
    const today = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/MyHrToday.tsx"),
      "utf8",
    );
    const perf = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Performance.tsx"),
      "utf8",
    );
    expect(payroll).toMatch(/downloadPayrollCsv\(data: Data, from: string, to: string, monthLabel\?:/);
    expect(payroll).toMatch(/const label = labelRaw\.slice\(0,\s*7\)/);
    expect(payroll).not.toMatch(/monthLabel = from\.slice\(0,\s*7\)/);
    expect(model).toMatch(/export function monthLabel\(month: unknown\)/);
    expect(today).toMatch(/typeof remDue === "string" \? remDue : String\(remDue\)/);
    expect(today).toMatch(/typeof r\.due === "string" \? r\.due : String\(r\.due\)/);
    expect(perf).toMatch(/typeof f\.due === "string" \? f\.due : String\(f\.due\)/);
  });
});
