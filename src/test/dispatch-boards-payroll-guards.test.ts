import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizePayrollVerify } from "@/admin/lib/payroll-verify";

describe("Dispatch ops/closeout boards + payroll summarize guards", () => {
  it("FollowUps/Accessorials/Equipment/Docs coerce lists before map/reload", () => {
    const ops = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    expect(ops).toMatch(/setRows\(Array\.isArray\(next\)/);
    expect(ops).toMatch(/safeLoads\.map/);
    expect(ops).toMatch(/buildEquipmentBoard\(\s*Array\.isArray\(drivers\)/);
    const closeout = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/CloseoutBoards.tsx"),
      "utf8",
    );
    expect(closeout).toMatch(/safeLoads/);
    expect(closeout).toMatch(/setRows\(Array\.isArray\(next\)/);
  });

  it("Handover watch hints coerce issues/followUps; Reports uses safeLoads for accessorial PDF", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/buildHandoverWatchHints\(\{[\s\S]*issues: Array\.isArray\(issues\)/);
    expect(src).toMatch(/exportAccessorialsPdf\(accessorials, safeLoads\)/);
  });

  it("summarizePayrollVerify tolerates non-array rows", () => {
    expect(summarizePayrollVerify(null as unknown as [])).toEqual({
      payablePkr: 0,
      actualPaidPkr: 0,
      variancePkr: 0,
      needsPolicyCount: 0,
    });
  });
});
