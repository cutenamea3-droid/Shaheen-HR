import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Personal LoginGate setup vs sign-in", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("secure mode never forces needsSetup just because ALLOW_SIGNUP=1", async () => {
    vi.stubEnv("VITE_PERSONAL_AUTH_SECURE", "1");
    vi.stubEnv("VITE_PERSONAL_ALLOW_SIGNUP", "1");
    vi.stubEnv("VITE_PERSONAL_SUPABASE_URL", "https://zlhrpymgwjswrmqhfatd.supabase.co");
    vi.stubEnv(
      "VITE_PERSONAL_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_xPkqddaoguNYule9N8kOFw_5Ra95Ald",
    );
    const { personalNeedsSetup, isPersonalSignupAllowed } = await import("@/personal/lib/session");
    expect(isPersonalSignupAllowed()).toBe(true);
    expect(personalNeedsSetup()).toBe(false);
  });

  it("LoginGate defaults to Sign In; Confirm only via explicit create-account toggle", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/PersonalApp.tsx"), "utf8");
    expect(src).toMatch(/wantSecureSignup/);
    expect(src).toMatch(/Need an account\? Create one/);
    expect(src).toMatch(/wantSecureSignup && isPersonalSignupAllowed\(\)/);
    expect(src).not.toMatch(/needsSetup && isPersonalSignupAllowed\(\)/);
  });

  it("secure mode toggle uses explicit enterSecureSignIn / enterSecureSignup (not flip-only)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/PersonalApp.tsx"), "utf8");
    expect(src).toMatch(/function enterSecureSignIn/);
    expect(src).toMatch(/function enterSecureSignup/);
    expect(src).toMatch(/setWantSecureSignup\(false\)/);
    expect(src).toMatch(/setWantSecureSignup\(true\)/);
    // Toggle lives outside <form> so it cannot be swallowed by submit handling.
    expect(src).toMatch(/data-testid="personal-auth-mode-toggle"/);
    expect(src).toMatch(/key=\{showConfirm \? "personal-signup" : "personal-signin"\}/);
  });
});
