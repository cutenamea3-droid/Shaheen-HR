import { describe, expect, it } from "vitest";
import { buildSeed, cellsOf, type AppData } from "@/lib/sections";
import { collectWorkCenterItems } from "@/lib/alerts-work-center";
import { buildFuturePlanSuggestion, PLAN_LEAD_RULES } from "@/lib/plan-dates";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("cellsOf helper", () => {
  it("returns empty array for null/undefined/non-array", () => {
    expect(cellsOf(null)).toEqual([]);
    expect(cellsOf({ cells: null })).toEqual([]);
    expect(cellsOf({ cells: ["a"] })).toEqual(["a"]);
  });
});

describe("work-center / plan-dates null cells", () => {
  it("does not throw on null cells rows", () => {
    const base = buildSeed();
    const broken = {
      ...base,
      sections: {
        ...base.sections,
        dmv: {
          ...base.sections.dmv,
          rows: base.sections.dmv.rows.map((r, i) =>
            i === 0 ? { ...r, cells: null as unknown as string[] } : r,
          ),
        },
      },
    } as AppData;
    expect(() => collectWorkCenterItems(broken)).not.toThrow();
    const rule = PLAN_LEAD_RULES.find((r) => r.sectionId === "dmv")!;
    expect(() =>
      buildFuturePlanSuggestion(rule, {
        id: "x",
        driverId: "d",
        cells: null as unknown as string[],
      }),
    ).not.toThrow();
  });

  it("cloudSave skips corrupt section JSON", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/flatMap\(\(\[id, json\]\) =>/);
    expect(src).toMatch(/JSON\.parse\(json\)/);
    expect(src).toMatch(/catch \{/);
  });
});
