import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("employee report days guards", () => {
  it("source coerces emp.days and model.employees with Array.isArray", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/employee-report-pdf.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(emp\.days\)/);
    expect(src).toMatch(/Array\.isArray\(model\.employees\)/);
    expect(src).toMatch(/Array\.isArray\(data\.employees\)/);
    expect(src).toMatch(/asText\(d\.rec\.note\)\.slice\(0,\s*80\)/);
    expect(src).not.toMatch(/\(d\.rec\.note \|\| ""\)\.slice/);
  });
});
