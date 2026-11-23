import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("maintenance banner (VITE_MAINTENANCE)", () => {
  it("isMaintenanceMode is true only when flag is exactly 1", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/maintenance.ts"), "utf8");
    expect(src).toMatch(/VITE_MAINTENANCE === "1"/);
  });

  it("MaintenanceBanner returns null when flag is off", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/MaintenanceBanner.tsx"), "utf8");
    expect(src).toMatch(/if \(!isMaintenanceMode\(\)\) return null/);
    expect(src).toMatch(/Under maintenance/);
    expect(src).toMatch(/data-testid="maintenance-banner"/);
  });

  it("root mounts MaintenanceBanner above AppSwitcher", () => {
    const src = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(src).toMatch(/MaintenanceBanner/);
    const bannerAt = src.indexOf("<MaintenanceBanner");
    const switcherAt = src.indexOf("<AppSwitcher");
    expect(bannerAt).toBeGreaterThan(-1);
    expect(switcherAt).toBeGreaterThan(bannerAt);
  });

  it(".env.example documents the flag as opt-in", () => {
    const env = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(env).toMatch(/# VITE_MAINTENANCE=1/);
  });
});
