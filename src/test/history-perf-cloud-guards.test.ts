import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectPerfStatements } from "@/admin/lib/perf-followups";

describe("history / perf / cloud residual guards", () => {
  it("compliance-history uses Array.isArray for portal/sensitive lists", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/compliance-history.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(opts\?\.portalActivity\)/);
    expect(src).toMatch(/Array\.isArray\(opts\?\.sensitiveAudit\)/);
    expect(src).not.toMatch(/opts\?\.portalActivity \?\? \[\]/);
    expect(src).not.toMatch(/opts\?\.sensitiveAudit \?\? \[\]/);
  });

  it("cloudSave coerces sections object before Object.entries", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/data\?\.sections && typeof data\.sections === "object"/);
  });

  it("dispatch handover open_load_ids uses Array.isArray", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(input\.open_load_ids\)/);
    expect(src).not.toMatch(/open_load_ids: input\.open_load_ids \?\? \[\]/);
  });

  it("collectPerfStatements tolerates corrupt hrStatements", () => {
    expect(() =>
      collectPerfStatements({
        employeeId: "e1",
        date: "2026-11-17",
        hrStatements: { bad: true } as never,
      }),
    ).not.toThrow();
    expect(
      collectPerfStatements({
        employeeId: "e1",
        date: "2026-11-17",
        hrStatements: { bad: true } as never,
      }),
    ).toEqual([]);
  });
});
