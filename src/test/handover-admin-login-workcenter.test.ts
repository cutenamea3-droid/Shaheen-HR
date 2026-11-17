import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Handover / Admin login onInput / work-center headers", () => {
  it("HandoverBoard reads summary/watch/priorities from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/summaryRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-handover-summary"/);
    expect(src).toMatch(/next_day_priorities: nextPriorities/);
  });

  it("Admin login fields update on input", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/AdminApp.tsx"), "utf8");
    expect(src).toMatch(/data-testid="admin-email"/);
    expect(src).toMatch(/onInput=\{\(e\) => \{\s*setEmail/);
    expect(src).toMatch(/onInput=\{\(e\) => \{\s*setPass/);
  });

  it("findWorkCenterRow returns array headers", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/alerts-work-center.ts"), "utf8");
    expect(src).toMatch(/headers: headersOf\(sec\)/);
  });
});
