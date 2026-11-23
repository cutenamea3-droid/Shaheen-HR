/**
 * SHRP-162 — Backup toolbar must use header-card contrast, not sidebar tokens.
 * Buttons that are unavailable must expose an honest reason string in source.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const controlsPath = resolve(
  __dirname,
  "../components/tracker/ComplianceDrBackupControls.tsx",
);

describe("Compliance DR toolbar visibility (SHRP-162)", () => {
  const src = readFileSync(controlsPath, "utf8");

  it("does not paint toolbar actions with sidebar-foreground on the card header", () => {
    expect(src).not.toMatch(/text-sidebar-foreground/);
    expect(src).not.toMatch(/hover:bg-sidebar-accent(?!-)/);
    expect(src).toMatch(/text-foreground/);
    expect(src).toMatch(/border-2/);
    expect(src).toMatch(/bg-card/);
  });

  it("exposes honest unavailable / busy reasons", () => {
    expect(src).toMatch(/Backup Now in progress/);
    expect(src).toMatch(/Complete Backup in progress/);
    expect(src).toMatch(/Restore preview \/ safe apply in progress/);
    expect(src).toMatch(/Off-site: not configured/);
    expect(src).toMatch(/Enter a passphrase of at least 8 characters/);
    expect(src).toMatch(/data-offsite-blocker/);
  });

  it("keeps Backup Now as the emphasized primary toolbar action", () => {
    expect(src).toMatch(/toolbarBtnPrimary/);
    expect(src).toMatch(/Backup Now/);
    expect(src).toMatch(/Complete Backup/);
    expect(src).toMatch(/Restore Complete/);
    expect(src).toMatch(/DR Status/);
  });

  it("preserves safe restore gating (dry-run → isolated → apply-safe)", () => {
    expect(src).toMatch(/"dry-run"/);
    expect(src).toMatch(/"isolated-test"/);
    expect(src).toMatch(/"apply-safe"/);
  });
});
