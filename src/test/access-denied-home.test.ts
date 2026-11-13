import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homePathFor, canAccessPath } from "@/lib/module-access";

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
      personal: null,
      dispatch: null,
    };
    expect(canAccessPath(grants, "/")).toBe(false);
    expect(canAccessPath(grants, "/admin")).toBe(true);
    expect(homePathFor(grants)).toBe("/admin");
  });

  it("dispatch-only cannot open Compliance and homes on /dispatch", () => {
    const grants = {
      compliance: null,
      "admin-hr": null,
      personal: null,
      dispatch: "dispatcher" as const,
    };
    expect(canAccessPath(grants, "/")).toBe(false);
    expect(homePathFor(grants)).toBe("/dispatch");
  });

  it("AccessDenied route resolves home via probe + homePathFor (not hardcoded /)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/routes/access-denied.tsx"), "utf8");
    expect(src).toMatch(/homePathFor/);
    expect(src).toMatch(/probeModuleGrants/);
    expect(src).not.toMatch(/<AccessDenied module=\{mod\} \/>/);
    expect(src).toMatch(/homePath=\{homePath\}/);
  });

  it("compliance grant still reaches / (authorized refresh path)", () => {
    const grants = {
      compliance: "admin" as const,
      "admin-hr": "admin" as const,
      personal: null,
      dispatch: null,
    };
    expect(canAccessPath(grants, "/")).toBe(true);
    expect(homePathFor(grants)).toBe("/");
  });
});
