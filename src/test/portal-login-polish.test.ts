import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("portal login polish (SHRP-138)", () => {
  it("shared shell has footer Made by HR / YOUSAF, not hero AboutPanel", () => {
    const shell = readFileSync(
      resolve(process.cwd(), "src/components/portal-login/PortalLoginShell.tsx"),
      "utf8",
    );
    expect(shell).toMatch(/Made by HR/);
    expect(shell).toMatch(/footerRole/);
    const complianceAbout = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AboutPanel.tsx"),
      "utf8",
    );
    const adminAbout = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/AboutPanel.tsx"),
      "utf8",
    );
    expect(complianceAbout).not.toMatch(/Made by HR/);
    expect(adminAbout).not.toMatch(/Made by HR/);
  });

  it("both portals use PasswordField + Forgot password + friendly copy", () => {
    const lock = readFileSync(resolve(process.cwd(), "src/components/tracker/LockGate.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "src/admin/AdminApp.tsx"), "utf8");
    for (const src of [lock, admin]) {
      expect(src).toMatch(/PasswordField/);
      expect(src).toMatch(/ForgotPasswordLink/);
      expect(src).toMatch(/PortalLoginShell/);
      expect(src).toMatch(/PortalLoginCard/);
      expect(src).not.toMatch(/Confirm email in\s+Supabase/);
      expect(src).not.toMatch(/turn off Confirm email/);
    }
  });

  it("logo is transparent (no rounded card chrome on the image)", () => {
    const card = readFileSync(
      resolve(process.cwd(), "src/components/portal-login/PortalLoginShell.tsx"),
      "utf8",
    );
    expect(card).toMatch(/bg-transparent object-contain/);
    expect(card).not.toMatch(/logo.*rounded-xl/);
  });
});
