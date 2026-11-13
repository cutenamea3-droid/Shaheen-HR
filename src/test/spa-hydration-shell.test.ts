import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";

/**
 * Contract: Cloudflare Pages ships a single SPA shell prerendered for `/`
 * (vite.config tanstackStart.spa). Root shell path-dependent UI must defer until
 * after hydration or React 19 throws #418 on refresh of non-Driver deep links.
 *
 * Production refresh matrix (2026-11-13): #418 on F5 for /admin /personal /dispatch
 * /access-denied /cv; clean on / and other Driver LockGate routes. Preview #41: 0× #418.
 */
describe("SPA hydration shell safety", () => {
  /** Paths that skip Driver LockGate after hydration — must not structurally differ on first paint. */
  const lockGateSkipPaths = ["/admin", "/personal", "/dispatch", "/access-denied", "/cv"] as const;
  /** Paths that keep Driver LockGate — match prerendered `/` shell tree. */
  const lockGateKeepPaths = ["/", "/drivers", "/alerts", "/account", "/team", "/activity", "/drug-tests", "/records"] as const;

  it("documents SPA prerender-for-/ in vite config", () => {
    const vite = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(vite).toMatch(/spa:\s*\{/);
    expect(vite).toMatch(/prerender/);
    expect(vite).toMatch(/outputPath:\s*"\/index\.html"/);
    expect(vite).toContain("nitro: false");
  });

  it("defers LockGate until useHydrated in root route", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toMatch(/useHydrated/);
    expect(root).toMatch(/useDriverLock/);
    expect(root).toMatch(/hydrated\s*&&/);
    expect(root).not.toMatch(/skipDriverLock\s*=\s*isAdmin/);
  });

  it("defers AppSwitcher active route until hydrated", () => {
    const sw = readFileSync(resolve(process.cwd(), "src/components/AppSwitcher.tsx"), "utf8");
    expect(sw).toMatch(/useHydrated/);
    expect(sw).toMatch(/hydrated && pathname\.startsWith\("\/admin"\)/);
  });

  it("isolates Admin / Personal / Dispatch route errors from the root shell", () => {
    for (const file of ["admin.tsx", "personal.tsx", "dispatch.tsx"] as const) {
      const src = readFileSync(resolve(process.cwd(), `src/routes/${file}`), "utf8");
      expect(src).toMatch(/errorComponent:/);
      expect(src).toMatch(/ModuleErrorPanel/);
    }
  });

  it("registers every refresh-sensitive portal path in the route tree", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of [...lockGateSkipPaths, ...lockGateKeepPaths]) {
      const id = router.matchRoutes(path).at(-1)?.routeId;
      expect(id, path).toBeTruthy();
      expect(id).not.toBe("__root__");
    }
  });

  it("encodes the Production refresh failure path classes (reproduce original #418 set)", () => {
    // Paths that threw React #418 on Production F5 (SPA shell = Driver LockGate + Driver-active).
    expect([...lockGateSkipPaths]).toEqual([
      "/admin",
      "/personal",
      "/dispatch",
      "/access-denied",
      "/cv",
    ]);
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toContain('pathname.startsWith("/admin")');
    expect(root).toContain('pathname.startsWith("/dispatch")');
    expect(root).toContain('pathname.startsWith("/personal")');
    expect(root).toContain('pathname.startsWith("/access-denied")');
    expect(root).toMatch(/pathname\s*===\s*"\/cv"/);
    // First paint must not apply LockGate until hydrated (matches prerender shell).
    expect(root).toMatch(/useDriverLock\s*=\s*[\s\S]*hydrated/);
  });
});
