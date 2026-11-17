import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { driverLoadHistory } from "@/dispatch/lib/cloud";

describe("dispatch preview list asRows guards", () => {
  it("preview list paths coerce mem arrays via asRows", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/asRows<RosterDriver>\(mem\(\)\.drivers\)/);
    expect(src).toMatch(/asRows<DispatchLoad>\(mem\(\)\.loads\)/);
    expect(src).toMatch(/asRows<DispatchIssue>\(mem\(\)\.issues\)/);
    expect(src).toMatch(/asRows<DispatchFollowUp>\(mem\(\)\.followUps\)/);
    expect(src).toMatch(/asRows<ShiftHandover>\(mem\(\)\.handovers\)/);
    expect(src).toMatch(/asRows<DispatchAccessorial>\(mem\(\)\.accessorials\)/);
  });

  it("driverLoadHistory tolerates non-array loads", () => {
    expect(driverLoadHistory(null as never, "d1")).toEqual([]);
  });
});
