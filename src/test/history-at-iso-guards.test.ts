import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { historyAtIso } from "@/lib/compliance-history";

describe("historyAtIso / SalaryPayments createdAt guards", () => {
  it("historyAtIso returns empty for non-finite and never throws", () => {
    expect(historyAtIso(NaN)).toBe("");
    expect(historyAtIso(undefined)).toBe("");
    expect(historyAtIso("not-a-date")).toBe("");
    expect(historyAtIso(1_700_000_000_000)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("panel + salary payments avoid raw Invalid Date toISOString", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/tracker/ComplianceHistoryPanel.tsx"),
      "utf8",
    );
    const pay = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/SalaryPayments.tsx"),
      "utf8",
    );
    const hist = readFileSync(resolve(process.cwd(), "src/lib/compliance-history.ts"), "utf8");
    expect(panel).toMatch(/dateTime=\{historyAtIso\(event\.at\)\}/);
    expect(panel).not.toMatch(/new Date\(event\.at\)\.toISOString\(\)/);
    expect(pay).toMatch(/Number\.isFinite\(ev\.createdAt\)/);
    expect(hist).toMatch(/function asAtMs\(at: unknown\)/);
    expect(hist).toMatch(/export function historyAtIso/);
  });
});
