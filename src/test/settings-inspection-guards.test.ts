import { describe, expect, it } from "vitest";
import { migrateSettings, defaultSettings } from "@/personal/lib/defaults";
import { usePersonal } from "@/personal/lib/store";
import { fleetInspectionCounts } from "@/lib/inspection-readiness";
import { buildFileCompletenessReport } from "@/lib/file-completeness";
import { buildSeed } from "@/lib/sections";

describe("settings / inspection count guards", () => {
  it("migrateSettings rejects non-object raw", () => {
    expect(migrateSettings(null as never)).toEqual(defaultSettings());
    expect(migrateSettings(["bad"] as never)).toEqual(defaultSettings());
    expect(migrateSettings({ weekdayMinutes: 150 }).weekdayMinutes).toBe(150);
  });

  it("setSettings heals corrupt settings then applies patch", () => {
    usePersonal.setState({ settings: null as never });
    usePersonal.getState().setSettings({ weekdayMinutes: 200 });
    expect(usePersonal.getState().settings.weekdayMinutes).toBe(200);
    expect(usePersonal.getState().settings.dailyTargetMinutes).toBe(200);
  });

  it("fleetInspectionCounts tolerates corrupt summaries/counts", () => {
    expect(() => fleetInspectionCounts(null as never)).not.toThrow();
    expect(
      fleetInspectionCounts([
        { driverId: "d1", driverName: "A", items: [], counts: null as never, worst: "present" },
      ]).drivers,
    ).toBe(1);
  });

  it("file completeness tolerates seed data", () => {
    expect(() => buildFileCompletenessReport(buildSeed())).not.toThrow();
  });
});
