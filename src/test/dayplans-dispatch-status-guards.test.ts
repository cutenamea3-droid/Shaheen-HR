import { describe, expect, it } from "vitest";
import { blocksOf, usePersonal } from "@/personal/lib/store";
import {
  homeActionBuckets,
  activeLoadsBoardColumns,
  filterLoads,
} from "@/dispatch/lib/status";
import { pairDrugTestEvents, filterDrugPairs } from "@/lib/driver-hr/drug-tests";

describe("dayPlans / Dispatch status / drug pair guards", () => {
  it("blocksOf and setDayBlockDone tolerate corrupt blocks", () => {
    expect(blocksOf(null)).toEqual([]);
    expect(blocksOf({ blocks: null })).toEqual([]);
    usePersonal.setState({
      dayPlans: {
        "2026-11-17": {
          date: "2026-11-17",
          mode: "normal",
          blocks: null as unknown as [],
        },
      },
    });
    expect(() => usePersonal.getState().setDayBlockDone("2026-11-17", "b1", true)).not.toThrow();
    expect(blocksOf(usePersonal.getState().dayPlans["2026-11-17"])).toEqual([]);
  });

  it("Personal persist merge heals dayPlans blocks", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { resolve } = require("node:path") as typeof import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    expect(src).toMatch(/healDayPlans\(raw\.dayPlans/);
    expect(src).toMatch(/blocksOf\(plan\)/);
  });

  it("Dispatch status helpers tolerate missing loads array", () => {
    expect(homeActionBuckets(null as unknown as []).needsUpdate).toEqual([]);
    expect(activeLoadsBoardColumns(undefined as unknown as []).every((c) => Array.isArray(c.items))).toBe(
      true,
    );
    expect(filterLoads({ bad: true } as unknown as [], { q: "x" })).toEqual([]);
  });

  it("drug pair helpers tolerate missing events/rows arrays", () => {
    expect(pairDrugTestEvents(null as unknown as [])).toEqual([]);
    expect(filterDrugPairs(undefined as unknown as [], { q: "x" })).toEqual([]);
  });
});
