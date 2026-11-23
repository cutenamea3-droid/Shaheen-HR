import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("My Compliance Today dark easy-scan (SHRP-141)", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/components/tracker/AlertsWorkCenter.tsx"),
    "utf8",
  );

  it("groups docs under each driver with Medical first", () => {
    expect(src).toMatch(/groupItemsBySection/);
    expect(src).toMatch(/sectionSortKey/);
    expect(src).toMatch(/s === "medical"|startsWith\("medical"\)/);
    expect(src).toMatch(/compliance-today-driver/);
    expect(src).toMatch(/compliance-today-scan/);
  });

  it("drops colored card chrome in favor of text severity", () => {
    expect(src).toMatch(/TONE_LABEL/);
    expect(src).not.toMatch(/TONE_ACCENT/);
    expect(src).not.toMatch(/TONE_DOT/);
    expect(src).not.toMatch(/border-l-danger|border-l-4 bg-card/);
  });

  it("keeps Backup/cloud paths out of this page rewrite (no store wipe)", () => {
    expect(src).not.toMatch(/localStorage\.clear|tracker_sections.*delete|resetAll/);
    expect(src).toMatch(/setCell/);
  });
});
