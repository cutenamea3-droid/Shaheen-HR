import { describe, expect, it } from "vitest";
import {
  buildWeeklyStats,
  emptyWeeklyReview,
  weekEndSunday,
  weekStartMonday,
} from "@/personal/lib/weekly-review";

describe("weekly-review ISO date coerce", () => {
  it("weekStartMonday / weekEndSunday tolerate non-string keys", () => {
    expect(() => weekStartMonday(20261117 as unknown as string)).not.toThrow();
    expect(() => weekStartMonday(null as unknown as string)).not.toThrow();
    expect(weekStartMonday("2026-11-17")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(() => weekEndSunday(42 as unknown as string)).not.toThrow();
  });

  it("buildWeeklyStats / emptyWeeklyReview coerce weekStart", () => {
    expect(() =>
      buildWeeklyStats(null as unknown as string, [], [], []),
    ).not.toThrow();
    const monday = weekStartMonday("2026-11-17");
    const stats = buildWeeklyStats(monday, [], [], []);
    expect(stats.weekStart).toBe(monday);
    expect(stats.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(emptyWeeklyReview(99 as unknown as string).weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
