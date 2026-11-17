import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Display name / weekly review / daily-summary headers", () => {
  it("AccountSettings display name reads DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AccountSettings.tsx"),
      "utf8",
    );
    expect(src).toMatch(/nameRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="compliance-display-name"/);
  });

  it("Personal weekly review + grade score read DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/personal/components/Analytics.tsx"),
      "utf8",
    );
    expect(src).toMatch(/winsRef\.current\?\.value/);
    expect(src).toMatch(/gScoreRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-weekly-wins"/);
  });

  it("daily-summary passes safe headers into analyzeRow", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/daily-summary.ts"), "utf8");
    expect(src).toMatch(/analyzeRow\(def, headersOf\(sec\), r\)/);
  });

  it("Admin designation updates on input", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-testid="admin-designation"/);
    expect(src).toMatch(/onInput=\{\(e\) => setDesignation/);
  });
});
