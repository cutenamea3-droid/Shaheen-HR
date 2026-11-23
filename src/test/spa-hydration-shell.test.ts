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
 * This app serves Compliance + Admin only; /personal and /dispatch are soft landings.
 */
describe("SPA hydration shell safety", () => {
  /** Paths that skip Driver LockGate after hydration — must not structurally differ on first paint. */
  const lockGateSkipPaths = ["/admin", "/personal", "/dispatch", "/access-denied", "/cv"] as const;
  /** Paths that keep Driver LockGate — match prerendered `/` shell tree. */
  const lockGateKeepPaths = [
    "/",
    "/drivers",
    "/alerts",
    "/account",
    "/team",
    "/activity",
    "/drug-tests",
    "/records",
  ] as const;

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

  it("defers AppSwitcher active route until hydrated (static / shell first paint)", () => {
    const sw = readFileSync(resolve(process.cwd(), "src/components/AppSwitcher.tsx"), "utf8");
    expect(sw).toMatch(/useHydrated/);
    // First paint must mirror prerendered `/` — not the real deep-link path.
    expect(sw).toMatch(/hydrated\s*\?\s*pathname\s*:\s*"\/"/);
    expect(sw).toMatch(/path\.startsWith\("\/admin"\)/);
    // Plain anchors until hydrated — TanStack Link injects real-path aria-current/data-status.
    expect(sw).toMatch(/ShellLink|plain anchors/i);
    expect(sw).toMatch(/if\s*\(\s*!hydrated\s*\)/);
  });

  it("clears AppSwitcher ready while re-probing seats (avoids stale hide of LoginGate links)", () => {
    const sw = readFileSync(resolve(process.cwd(), "src/components/AppSwitcher.tsx"), "utf8");
    expect(sw).toMatch(/setReady\(false\)/);
    expect(sw).toMatch(/probeModuleGrants/);
    // While !ready, company LoginGate surfaces stay reachable (Compliance + Admin only).
    expect(sw).toMatch(/\["compliance",\s*"admin-hr"\]/);
    expect(sw).not.toMatch(/to="\/dispatch"/);
    expect(sw).not.toMatch(/to="\/personal"/);
  });

  it("pins the Production #418 mismatched shell components", () => {
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    const sw = readFileSync(resolve(process.cwd(), "src/components/AppSwitcher.tsx"), "utf8");
    expect(root).toMatch(/useDriverLock/);
    expect(root).toMatch(/useHydrated/);
    expect(sw).toMatch(/aria-current/);
    expect(sw).toContain("prerendered for `/`");
  });

  it("isolates Admin route errors; Personal/Dispatch are soft landings", () => {
    const admin = readFileSync(resolve(process.cwd(), "src/routes/admin.tsx"), "utf8");
    expect(admin).toMatch(/errorComponent:/);
    expect(admin).toMatch(/ModuleErrorPanel/);
    for (const file of ["personal.tsx", "dispatch.tsx"] as const) {
      const src = readFileSync(resolve(process.cwd(), `src/routes/${file}`), "utf8");
      expect(src).toMatch(/not in this app/i);
      expect(src).not.toMatch(/from ["']@\/personal\/PersonalApp["']/);
      expect(src).not.toMatch(/from ["']@\/dispatch\/DispatchApp["']/);
      expect(src).not.toMatch(/<\s*PersonalApp|<\s*DispatchApp/);
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

  it("encodes LockGate skip paths for Admin + retired soft landings", () => {
    expect([...lockGateSkipPaths]).toEqual([
      "/admin",
      "/personal",
      "/dispatch",
      "/access-denied",
      "/cv",
    ]);
    const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toContain('pathname.startsWith("/admin")');
    expect(root).toMatch(/isRetiredPortal|startsWith\("\/dispatch"\)|startsWith\("\/personal"\)/);
    expect(root).toContain('pathname.startsWith("/access-denied")');
    expect(root).toMatch(/pathname\s*===\s*"\/cv"/);
    expect(root).toMatch(/useDriverLock\s*=\s*[\s\S]*hydrated/);
  });
});
