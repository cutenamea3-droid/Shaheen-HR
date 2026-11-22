import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("portal-local email coerce guards", () => {
  it("list/create/find use portalEmailKey instead of raw .toLowerCase on email", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/portal-local.ts"), "utf8");
    expect(src).toMatch(/function portalEmailKey\(v: unknown\): string/);
    expect(src).toMatch(/email: portalEmailKey\(\(a as PortalAccount\)\.email\)/);
    expect(src).toMatch(/portalEmailKey\(a\.email\) === email/);
    expect(src).toMatch(/portalEmailKey\(a\.email\) === normalized/);
    expect(src).not.toMatch(/a\.email\.toLowerCase\(\)/);
  });

  it("Admin addEmployee coerces joinMonth via normalizeEmployee", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/store.ts"), "utf8");
    expect(src).toMatch(/export function normalizeEmployee\(/);
    expect(src).toMatch(/const base = normalizeEmployee\(\{ \.\.\.e, id \}\)/);
    expect(src).toMatch(/const effectiveFrom = `\$\{base\.joinMonth\}-01`/);
    expect(src).not.toMatch(/\$\{\(e\.joinMonth \|\| new Date\(\)\.toISOString\(\)\.slice\(0,\s*7\)\)\}-01/);
  });
});
