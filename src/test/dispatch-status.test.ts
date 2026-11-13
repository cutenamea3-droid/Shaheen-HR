import { describe, expect, it } from "vitest";
import {
  activeLoadsBoardColumns,
  canTransition,
  filterLoads,
  homeActionBuckets,
  isStaleUpdate,
} from "@/dispatch/lib/status";
import { loadsToCsv } from "@/dispatch/lib/reports";
import type { DispatchLoad } from "@/dispatch/lib/types";
import { fixtureLoads } from "@/dispatch/lib/fixtures";
import { forbiddenModulePathsForDispatcher, isDispatchPath } from "@/dispatch/lib/auth";

function load(partial: Partial<DispatchLoad>): DispatchLoad {
  return {
    ...fixtureLoads[0],
    ...partial,
  };
}

describe("Dispatch status model", () => {
  it("treats Delivered as distinct from Closed", () => {
    expect(canTransition("delivered", "closed")).toBe(true);
    expect(canTransition("in_transit", "closed")).toBe(false);
    expect(canTransition("closed", "in_transit")).toBe(false);
  });

  it("marks stale active loads and builds action lists over counters", () => {
    const stale = load({
      id: "a",
      status: "in_transit",
      updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      stale_after_minutes: 120,
      last_manual_location_at: null,
    });
    const fresh = load({
      id: "b",
      status: "planned",
      updated_at: new Date().toISOString(),
      last_manual_location_at: new Date().toISOString(),
      exception_open: true,
    });
    expect(isStaleUpdate(stale)).toBe(true);
    expect(isStaleUpdate(fresh)).toBe(false);
    const buckets = homeActionBuckets([stale, fresh]);
    expect(buckets.needsUpdate.some((l) => l.id === "a")).toBe(true);
    expect(buckets.openExceptions.some((l) => l.id === "b")).toBe(true);
  });

  it("filters/search without inventing GPS fields", () => {
    const rows = filterLoads(fixtureLoads, { q: "midwest", status: "all" });
    expect(rows.map((r) => r.load_number)).toContain("SH-1001");
    expect(loadsToCsv(rows)).toContain("manual_location");
    expect(loadsToCsv(rows).toLowerCase()).not.toContain("live gps");
  });

  it("isolates dispatch path helpers from other modules", () => {
    expect(isDispatchPath("/dispatch")).toBe(true);
    expect(isDispatchPath("/admin")).toBe(false);
    expect(forbiddenModulePathsForDispatcher()).toEqual(
      expect.arrayContaining(["/", "/admin", "/drug-tests", "/personal"]),
    );
  });

  it("builds Active Loads board columns without inventing statuses", () => {
    const columns = activeLoadsBoardColumns([
      load({ id: "1", status: "in_transit", load_number: "B7-1" }),
      load({ id: "2", status: "planned", load_number: "B7-2" }),
      load({ id: "3", status: "closed", load_number: "B7-3" }),
    ]);
    expect(columns.find((c) => c.status === "in_transit")?.items.map((l) => l.id)).toEqual(["1"]);
    expect(columns.find((c) => c.status === "planned")?.items.map((l) => l.id)).toEqual(["2"]);
    expect(columns.every((c) => c.status !== "closed")).toBe(true);
  });
});
