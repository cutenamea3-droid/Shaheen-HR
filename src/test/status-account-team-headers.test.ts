import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeRow } from "@/lib/alerts";
import { SECTIONS } from "@/lib/sections";

describe("Status custom / Account / Team autofill + analyzeRow headers", () => {
  it("StatusToggle custom reads DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/cells.tsx"), "utf8");
    expect(src).toMatch(/customRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="status-custom"/);
  });

  it("StatusToggle / Dashboard / AddDriver coerce statusOptions before map/includes", () => {
    const cells = readFileSync(resolve(process.cwd(), "src/components/tracker/cells.tsx"), "utf8");
    const dash = readFileSync(resolve(process.cwd(), "src/components/tracker/Dashboard.tsx"), "utf8");
    const add = readFileSync(resolve(process.cwd(), "src/components/tracker/AddDriverDialog.tsx"), "utf8");
    expect(cells).toMatch(/safeOptions = Array\.isArray\(options\) \? options\.map\(asCellText\) : \[\]/);
    expect(dash).toMatch(/Array\.isArray\(def\.statusOptions\) \? def\.statusOptions : \[\]/);
    expect(add).toMatch(/Array\.isArray\(def\.statusOptions\) \? def\.statusOptions : \[\]/);
  });

  it("AccountSettings and TeamManagement read password fields from DOM", () => {
    const acct = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AccountSettings.tsx"),
      "utf8",
    );
    const team = readFileSync(
      resolve(process.cwd(), "src/components/tracker/TeamManagement.tsx"),
      "utf8",
    );
    expect(acct).toMatch(/currentPasswordRef\.current\?\.value/);
    expect(acct).toMatch(/data-testid="compliance-new-password"/);
    expect(team).toMatch(/emailRef\.current\?\.value/);
    expect(team).toMatch(/data-testid="team-user-email"/);
  });

  it("analyzeRow does not throw on missing/short headers", () => {
    const def = SECTIONS.find((s) => s.id === "dmv")!;
    const row = {
      id: "r1",
      driverId: "d1",
      cells: ["Driver", "CA", "Missing", "", "", "", "", "", "CA"],
      addedAt: 1,
    };
    expect(() => analyzeRow(def, [], row)).not.toThrow();
    expect(() => analyzeRow(def, undefined as unknown as string[], row)).not.toThrow();
  });
});
