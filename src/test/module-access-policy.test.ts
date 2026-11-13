import { describe, expect, it } from "vitest";
import {
  assertNoTokenBridge,
  canAccessPath,
  describeAuthBoundaries,
  hasPrivilege,
  homePathFor,
  isDispatchOnly,
  isLocalRoleSourceOfTruth,
  moduleForPath,
  privilegesFor,
  resolveAccess,
  seatsToGrants,
  selectableModulesFor,
} from "@/lib/module-access";

describe("module-access policy", () => {
  it("maps roles for admin / compliance / HR / dispatcher / personal-owner", () => {
    const grants = seatsToGrants([
      { module: "compliance", role: "admin", active: true },
      { module: "admin-hr", role: "standard", active: true },
      { module: "dispatch", role: "dispatcher", active: true },
      { module: "personal", role: "owner", active: true },
    ]);
    expect(grants.compliance).toBe("admin");
    expect(grants["admin-hr"]).toBe("standard");
    expect(grants.dispatch).toBe("dispatcher");
    expect(grants.personal).toBe("owner");
  });

  it("ignores inactive seats", () => {
    const grants = seatsToGrants([{ module: "dispatch", role: "admin", active: false }]);
    expect(grants.dispatch).toBeNull();
  });

  it("dispatch-only auto-homes on /dispatch", () => {
    const grants = seatsToGrants([{ module: "dispatch", role: "dispatcher", active: true }]);
    expect(isDispatchOnly(grants)).toBe(true);
    expect(homePathFor(grants)).toBe("/dispatch");
    expect(canAccessPath(grants, "/")).toBe(false);
    expect(canAccessPath(grants, "/admin")).toBe(false);
    expect(canAccessPath(grants, "/personal")).toBe(false);
    expect(canAccessPath(grants, "/dispatch")).toBe(true);
  });

  it("least-privilege: drug/rate for compliance admin; finance for admin-hr admin", () => {
    expect(privilegesFor({ compliance: "admin", "admin-hr": null, personal: null, dispatch: null })).toEqual([
      "drug",
      "rate",
    ]);
    expect(hasPrivilege({ compliance: "standard", "admin-hr": null, personal: null, dispatch: null }, "drug")).toBe(
      false,
    );
    expect(hasPrivilege({ compliance: null, "admin-hr": "admin", personal: null, dispatch: null }, "finance")).toBe(
      true,
    );
    expect(hasPrivilege({ compliance: null, "admin-hr": "standard", personal: null, dispatch: null }, "finance")).toBe(
      false,
    );
  });

  it("hides Personal from company switcher unless already on /personal", () => {
    const grants = seatsToGrants([
      { module: "compliance", role: "admin", active: true },
      { module: "personal", role: "owner", active: true },
    ]);
    expect(selectableModulesFor(grants, { pathname: "/" })).toEqual(["compliance"]);
    expect(selectableModulesFor(grants, { pathname: "/personal" })).toEqual(["compliance", "personal"]);
  });

  it("anonymous / empty grants land on access-denied home", () => {
    const access = resolveAccess({
      compliance: null,
      "admin-hr": null,
      personal: null,
      dispatch: null,
    });
    expect(access.homePath).toBe("/access-denied");
    expect(access.selectableModules).toEqual([]);
  });

  it("classifies paths for URL denial", () => {
    expect(moduleForPath("/drug-tests")).toBe("compliance");
    expect(moduleForPath("/admin")).toBe("admin-hr");
    expect(moduleForPath("/dispatch")).toBe("dispatch");
    expect(moduleForPath("/personal")).toBe("personal");
    expect(moduleForPath("/cv")).toBe("public");
    expect(moduleForPath("/access-denied")).toBe("access-denied");
  });
});

describe("auth honesty", () => {
  it("forbids Driver↔Admin and Personal bridges; allows same-project", () => {
    expect(() => assertNoTokenBridge("driver", "driver")).not.toThrow();
    expect(() => assertNoTokenBridge("driver", "admin-lovable")).toThrow(/Unsafe token bridge/);
    expect(() => assertNoTokenBridge("admin-lovable", "driver")).toThrow(/Unsafe token bridge/);
    expect(() => assertNoTokenBridge("personal", "driver")).toThrow(/Unsafe token bridge/);
    expect(isLocalRoleSourceOfTruth()).toBe(false);
    expect(describeAuthBoundaries().length).toBeGreaterThan(3);
  });
});
