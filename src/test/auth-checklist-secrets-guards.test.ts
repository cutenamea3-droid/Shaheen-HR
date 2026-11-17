import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  hasPersonalCredentials,
  readPersonalSession,
  readPersonalSessionLogin,
} from "@/personal/lib/auth";
import { hasHrLocalPassword, readHrLocalSessionEmail } from "@/admin/lib/hr-auth-local";
import { hasLocalPassword } from "@/lib/portal-local";

describe("auth / checklist / secrets object guards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Personal secrets/session tolerate corrupt JSON shapes", () => {
    localStorage.setItem("hr-personal-auth-secrets-v1", JSON.stringify(["bad"]));
    expect(hasPersonalCredentials()).toBe(false);
    localStorage.setItem("hr-personal-auth-session-v1", JSON.stringify("oops"));
    expect(readPersonalSession()).toBe(false);
    expect(readPersonalSessionLogin()).toBeNull();
  });

  it("Admin secrets/session tolerate corrupt JSON shapes", () => {
    localStorage.setItem("shaheen-hr-account-secrets-v1", JSON.stringify(null));
    expect(hasHrLocalPassword("a@b.com")).toBe(false);
    localStorage.setItem("shaheen-hr-account-session-v1", JSON.stringify(["x"]));
    expect(readHrLocalSessionEmail()).toBeNull();
  });

  it("portal secrets map heals non-object localStorage", () => {
    localStorage.setItem("shaheen-driver-portal-secrets-v1", JSON.stringify([1, 2]));
    expect(hasLocalPassword("u1")).toBe(false);
  });

  it("Dashboard checklist parse coerces object (source)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/Dashboard.tsx"), "utf8");
    expect(src).toMatch(/typeof parsed === "object" && !Array\.isArray\(parsed\)/);
    expect(src).toMatch(/safeDone/);
  });
});
