import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_APP_ID,
  backupCoverageSummary,
  clearComplianceTodayViewState,
  exportBackup,
  getData,
  importBackup,
  resetToSpreadsheet,
  setCell,
} from "@/lib/store";
import { buildSeed } from "@/lib/sections";
import { useDrugTestMock } from "@/lib/driver-hr/drug-test-mock";
import { clearAllFuturePlanExpanded, setFuturePlanExpanded } from "@/lib/future-plan-expand";

describe("Backup covers Compliance Today data (SHRP-150)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetToSpreadsheet();
    useDrugTestMock.getState().clearAll();
    clearAllFuturePlanExpanded();
  });

  it("export envelope covers plans, notes, docs, follow-ups, records", () => {
    const json = exportBackup();
    const parsed = JSON.parse(json) as {
      app: string;
      version: number;
      coverage: Record<string, unknown>;
      data: { sections: Record<string, unknown> };
    };
    expect(parsed.app).toBe(BACKUP_APP_ID);
    expect(parsed.version).toBe(2);
    expect(parsed.coverage.plans).toBe(true);
    expect(parsed.coverage.notes).toBe(true);
    expect(parsed.coverage.docs).toBe(true);
    expect(parsed.coverage.followUps).toBe(true);
    expect(parsed.coverage.records).toBe(true);
    expect(["mock", "secure-cloud", "none"]).toContain(parsed.coverage.drugTests);
    expect(parsed.data.sections.medical).toBeTruthy();
    expect(parsed.data.sections.docs).toBeTruthy();
    expect(backupCoverageSummary(json)).toMatch(/plans/);
  });

  it("round-trips saved Future Plan and temp note via importBackup", () => {
    const data = getData();
    const med = data.sections.medical;
    const row = med.rows[0];
    expect(row).toBeTruthy();
    const planCol = 6;
    const noteCol = 7;
    setCell("medical", row.id, planCol, "Call clinic Fri");
    setCell("medical", row.id, noteCol, "Temp: bring med card");

    const json = exportBackup();
    resetToSpreadsheet();
    importBackup(json);

    const again = getData().sections.medical.rows.find((r) => r.id === row.id);
    expect(again?.cells[planCol]).toBe("Call clinic Fri");
    expect(again?.cells[noteCol]).toBe("Temp: bring med card");
  });

  it("includes mock drug/CCF events in backup and restores them (isolated/mock only)", () => {
    useDrugTestMock.getState().add(
      {
        driverId: "d_test",
        kind: "federal_drug",
        specimenId: "SP-1",
        reason: "Pre-Employment",
        collectionContext: "Clinic",
        eventDate: "2026-01-15",
        notes: "CCF copy",
        testingEventId: "te_backup_1",
      },
      "test",
    );

    const json = exportBackup();
    const parsed = JSON.parse(json) as { coverage: { drugTests: string }; drugTests?: unknown[] };
    expect(parsed.coverage.drugTests).toBe("mock");
    expect(Array.isArray(parsed.drugTests) && parsed.drugTests.length).toBeTruthy();

    useDrugTestMock.getState().clearAll();
    expect(useDrugTestMock.getState().events.length).toBe(0);

    importBackup(json);
    const restored = useDrugTestMock.getState().events;
    expect(restored.some((e) => e.specimenId === "SP-1" && e.notes === "CCF copy")).toBe(true);
  });

  it("still accepts legacy raw AppData backups", () => {
    expect(() => importBackup(JSON.stringify(buildSeed()))).not.toThrow();
    expect(Object.keys(getData().sections).length).toBeGreaterThan(0);
  });

  it("clearComplianceTodayViewState clears checklist + expand, not plans", () => {
    localStorage.setItem("shaheen-checklist-2026-11-23", JSON.stringify({ a: true }));
    localStorage.setItem("shaheen-compliance-today-detail", "detailed");
    setFuturePlanExpanded("medical:r1:6");

    const data = getData();
    const row = data.sections.medical.rows[0];
    setCell("medical", row.id, 6, "Keep this plan");

    const result = clearComplianceTodayViewState();
    expect(result.clearedChecklistKeys).toBeGreaterThanOrEqual(1);
    expect(localStorage.getItem("shaheen-checklist-2026-11-23")).toBeNull();
    expect(localStorage.getItem("shaheen-compliance-today-detail")).toBeNull();
    expect(getData().sections.medical.rows.find((r) => r.id === row.id)?.cells[6]).toBe(
      "Keep this plan",
    );
  });
});
