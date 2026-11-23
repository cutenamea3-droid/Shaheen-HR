import { describe, expect, it } from "vitest";
import {
  assertNoTokenBridge,
  canAccessPath,
  companySwitcherModules,
  describeAuthBoundaries,
  hasPrivilege,
  homePathFor,
  isIndependentLoginModule,
  isLocalRoleSourceOfTruth,
  moduleForPath,
  privilegesFor,
  resolveAccess,
  seatsToGrants,
  selectableModulesFor,
  shouldDenyModulePath,
} from "@/lib/module-access";

describe("module-access policy (Compliance + Attendance)", () => {
  it("maps roles for admin / compliance only", () => {
    const grants = seatsToGrants([
      { module: "compliance", role: "admin", active: true },
      { module: "admin-hr", role: "standard", active: true },
    ]);
    expect(grants.compliance).toBe("admin");
    expect(grants["admin-hr"]).toBe("standard");
  });

  it("ignores inactive seats", () => {
    const grants = seatsToGrants([{ module: "compliance", role: "admin", active: false }]);
    expect(grants.compliance).toBeNull();
  });

  it("least-privilege: drug/rate for compliance admin; finance for admin-hr admin", () => {
    expect(privilegesFor({ compliance: "admin", "admin-hr": null })).toEqual(["drug", "rate"]);
    expect(hasPrivilege({ compliance: "standard", "admin-hr": null }, "drug")).toBe(false);
    expect(hasPrivilege({ compliance: null, "admin-hr": "admin" }, "finance")).toBe(true);
    expect(hasPrivilege({ compliance: null, "admin-hr": "standard" }, "finance")).toBe(false);
  });

  it("switcher only lists Compliance + Admin", () => {
    const grants = seatsToGrants([{ module: "compliance", role: "admin", active: true }]);
    expect(selectableModulesFor(grants, { pathname: "/" })).toEqual(["compliance"]);
    expect(companySwitcherModules(grants)).toEqual(["compliance", "admin-hr"]);
  });

  it("anonymous / empty grants land on access-denied home", () => {
    const access = resolveAccess({
      compliance: null,
      "admin-hr": null,
    });
    expect(access.homePath).toBe("/access-denied");
    expect(access.selectableModules).toEqual([]);
  });

  it("classifies paths for URL denial", () => {
    expect(moduleForPath("/drug-tests")).toBe("compliance");
    expect(moduleForPath("/admin")).toBe("admin-hr");
    expect(moduleForPath("/personal")).toBeNull();
    expect(moduleForPath("/dispatch")).toBeNull();
    expect(moduleForPath("/cv")).toBe("public");
    expect(moduleForPath("/access-denied")).toBe("access-denied");
  });

  it("never Access-Denies Admin LoginGate", () => {
    const complianceOnly = seatsToGrants([{ module: "compliance", role: "admin", active: true }]);
    expect(isIndependentLoginModule("admin-hr")).toBe(true);
    expect(isIndependentLoginModule("compliance")).toBe(false);

    expect(canAccessPath(complianceOnly, "/admin")).toBe(false);
    expect(shouldDenyModulePath(complianceOnly, "/admin")).toBe(false);
    expect(shouldDenyModulePath(complianceOnly, "/")).toBe(false);
  });

  it("still Access-Denies Compliance URLs for Admin-only seats", () => {
    const adminOnly = seatsToGrants([{ module: "admin-hr", role: "admin", active: true }]);
    expect(shouldDenyModulePath(adminOnly, "/")).toBe(true);
    expect(shouldDenyModulePath(adminOnly, "/admin")).toBe(false);
    expect(shouldDenyModulePath({ compliance: null, "admin-hr": null }, "/")).toBe(false);
  });
});

describe("auth honesty", () => {
  it("forbids Driver↔Admin bridges; allows same-project", () => {
    expect(() => assertNoTokenBridge("driver", "driver")).not.toThrow();
    expect(() => assertNoTokenBridge("driver", "admin-lovable")).toThrow(/Unsafe token bridge/);
    expect(() => assertNoTokenBridge("admin-lovable", "driver")).toThrow(/Unsafe token bridge/);
    expect(isLocalRoleSourceOfTruth()).toBe(false);
    expect(describeAuthBoundaries().length).toBeGreaterThan(2);
  });
});
