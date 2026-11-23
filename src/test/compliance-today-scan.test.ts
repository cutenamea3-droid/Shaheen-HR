import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("My Compliance Today redesign (SHRP-150)", () => {
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

  it("uses compact status badges, not large tone bars", () => {
    expect(src).toMatch(/TONE_LABEL/);
    expect(src).toMatch(/Chip tone=\{item\.tone\}/);
    expect(src).not.toMatch(/TONE_ACCENT/);
    expect(src).not.toMatch(/border-l-danger|border-l-4 bg-card/);
  });

  it("shows saved plan, action, expiry, and full record per doc", () => {
    expect(src).toMatch(/Saved plan/);
    expect(src).toMatch(/Expiry \/ due/);
    expect(src).toMatch(/neededAction/);
    expect(src).toMatch(/Full record/);
    expect(src).toMatch(/Future Plan \(manual edit\)/);
    expect(src).toMatch(/FuturePlanSuggest/);
  });

  it("offers Compact / Detailed without changing filter logic", () => {
    expect(src).toMatch(/Compact/);
    expect(src).toMatch(/Detailed/);
    expect(src).toMatch(/WORK_CENTER_FILTERS/);
    expect(src).toMatch(/filterWorkCenterItems/);
    expect(src).toMatch(/collectWorkCenterItems/);
  });

  it("keeps Backup/cloud paths out of this page rewrite (no store wipe)", () => {
    expect(src).not.toMatch(/localStorage\.clear|tracker_sections.*delete|resetAll/);
    expect(src).toMatch(/setCell/);
  });
});
