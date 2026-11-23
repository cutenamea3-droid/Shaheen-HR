import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homePathFor, canAccessPath, shouldDenyModulePath } from "@/lib/module-access";

/**
 * Reproduces owner Production HTML:
 *   /access-denied?module=compliance
 *   "You do not have permission for Driver Compliance."
 *
 * Trigger: Admin-HR soft/local seat without Compliance grant + visit `/`
 * (ModuleRedirector). Broken follow-up: AccessDenied defaulted homePath to `/`,
 * which re-entered the deny loop; Production F5 on /access-denied also threw #418.
 */
describe("access-denied home path (auth race / sticky loop)", () => {
  it("admin-hr-only cannot open Compliance and homes on /admin", () => {
    const grants = {
      compliance: null,
      "admin-hr": "admin" as const,
    };
    expect(canAccessPath(grants, "/")).toBe(false);
    expect(canAccessPath(grants, "/admin")).toBe(true);
    expect(shouldDenyModulePath(grants, "/")).toBe(true);
    expect(shouldDenyModulePath(grants, "/admin")).toBe(false);
    expect(homePathFor(grants)).toBe("/admin");
  });

  it("AccessDenied route resolves home via probe + homePathFor (not hardcoded /)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/routes/access-denied.tsx"), "utf8");
    expect(src).toMatch(/homePathFor/);
    expect(src).toMatch(/probeModuleGrants/);
    expect(src).not.toMatch(/<AccessDenied module=\{mod\} \/>/);
    expect(src).toMatch(/homePath=\{homePath\}/);
  });

  it("ModuleRedirector resets ready on pathname change (stale-grant race)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/ModuleRedirector.tsx"), "utf8");
    expect(src).toMatch(/setReady\(false\)/);
    expect(src).toMatch(/shouldDenyModulePath/);
    expect(src).not.toMatch(/canAccessPath\(grants, pathname\)/);
  });

  it("ModuleRedirector re-probes when Driver Auth state changes", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/ModuleRedirector.tsx"), "utf8");
    expect(src).toMatch(/onAuthStateChange/);
    expect(src).toMatch(/authEpoch/);
    expect(src).toMatch(/shaheen-lock/);
    expect(src).toMatch(/shaheen-portal-ready/);
    expect(src).toMatch(/hasPortalSession/);
  });

  it("LockGate announces portal-ready after ACL sign-in", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/LockGate.tsx"), "utf8");
    expect(src).toMatch(/shaheen-portal-ready/);
  });

  it("probeModuleGrants retries Compliance ACL after session", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/module-access/resolve.ts"), "utf8");
    expect(src).toMatch(/getUser\(\)/);
    expect(src).toMatch(/for \(let i = 0; i < 4; i\+\+\)/);
    expect(src).not.toMatch(/probePersonalOwnerSeat/);
    expect(src).not.toMatch(/getDispatchAccount/);
  });

  it("AccessDenied page leaves after Compliance seat arrives", () => {
    const src = readFileSync(resolve(process.cwd(), "src/routes/access-denied.tsx"), "utf8");
    expect(src).toMatch(/onAuthStateChange/);
    expect(src).toMatch(/canAccessPath\(grants, "\/"\)/);
    expect(src).toMatch(/navigate\(\{ to: home, replace: true \}\)/);
  });

  it("AdminOnly privilege deny uses need=admin (not module-missing copy)", () => {
    const adminOnly = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AdminOnly.tsx"),
      "utf8",
    );
    expect(adminOnly).toMatch(/need:\s*"admin"/);
    const denied = readFileSync(resolve(process.cwd(), "src/routes/access-denied.tsx"), "utf8");
    expect(denied).toMatch(/needAdmin/);
    expect(denied).toMatch(/requires a Driver Compliance admin account/);
  });

  it("compliance seat still reaches Admin LoginGate URL", () => {
    const grants = {
      compliance: "admin" as const,
      "admin-hr": null,
    };
    expect(shouldDenyModulePath(grants, "/admin")).toBe(false);
  });

  it("compliance grant still reaches / (authorized refresh path)", () => {
    const grants = {
      compliance: "admin" as const,
      "admin-hr": "admin" as const,
    };
    expect(canAccessPath(grants, "/")).toBe(true);
    expect(shouldDenyModulePath(grants, "/")).toBe(false);
    expect(homePathFor(grants)).toBe("/");
  });
});
