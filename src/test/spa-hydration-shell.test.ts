import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contract: Cloudflare Pages ships a single SPA shell prerendered for `/`
 * (vite.config tanstackStart.spa). Root shell path-dependent UI must defer until
 * after hydration or React 19 throws #418 on /admin /personal /dispatch.
 */
describe("SPA hydration shell safety", () => {
  it("documents SPA prerender-for-/ in vite config", () => {
    const vite = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(vite).toMatch(/spa:\s*\{/);
    expect(vite).toMatch(/prerender/);
    expect(vite).toMatch(/outputPath:\s*"\/index\.html"/);
  });

  it("defers LockGate until useHydrated in root route", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toMatch(/useHydrated/);
    expect(root).toMatch(/useDriverLock/);
    expect(root).not.toMatch(/skipDriverLock\s*=\s*isAdmin/);
  });

  it("defers AppSwitcher active route until hydrated", () => {
    const sw = readFileSync(resolve(process.cwd(), "src/components/AppSwitcher.tsx"), "utf8");
    expect(sw).toMatch(/useHydrated/);
    expect(sw).toMatch(/hydrated && pathname\.startsWith\("\/admin"\)/);
  });

  it("isolates Admin route errors from the root shell", () => {
    const admin = readFileSync(resolve(process.cwd(), "src/routes/admin.tsx"), "utf8");
    expect(admin).toMatch(/errorComponent:\s*AdminError/);
    expect(admin).toMatch(/ModuleErrorPanel/);
  });
});
