import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERSONAL_SB_AUTH_STORAGE_KEY } from "@/personal/integrations/supabase/client";

describe("probePersonalOwnerSeat storage contract", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("detects prefixed Personal auth storage used by the real client adapter", async () => {
    const prefixed = `${PERSONAL_SB_AUTH_STORAGE_KEY}:${PERSONAL_SB_AUTH_STORAGE_KEY}`;
    localStorage.setItem(
      prefixed,
      JSON.stringify({ access_token: "dummy", refresh_token: "x", user: { id: "u1" } }),
    );
    // Bare key alone must not be required (that was the false-negative).
    expect(localStorage.getItem(PERSONAL_SB_AUTH_STORAGE_KEY)).toBeNull();

    const { probePersonalOwnerSeat } = await import("@/personal/lib/auth-probe");
    await expect(probePersonalOwnerSeat()).resolves.toBe(true);
  });

  it("returns false when no Personal auth blob exists", async () => {
    const { probePersonalOwnerSeat } = await import("@/personal/lib/auth-probe");
    await expect(probePersonalOwnerSeat()).resolves.toBe(false);
  });

  it("source uses getPersonalSupabase — never imports a second createClient", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/auth-probe.ts"), "utf8");
    expect(src).toMatch(/getPersonalSupabase/);
    expect(src).toMatch(/PERSONAL_SB_AUTH_STORAGE_KEY/);
    expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
    expect(src).not.toMatch(/await import\(["']@supabase\/supabase-js["']\)/);
  });
});
