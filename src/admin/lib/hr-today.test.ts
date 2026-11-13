import { describe, expect, it } from "vitest";
import { buildHrToday, hrTodaySyncLabel } from "./hr-today";
import { emptyRec, type DayRec, type Dept, type Employee, type Settings } from "./types";

const depts: Dept[] = [
  { id: "hr", name: "HR", start: 360, end: 960 },
  { id: "dispatch", name: "Dispatch", start: 300, end: 900 },
];

const settings: Settings = {
  company: "T",
  grace: 15,
  breakMin: 45,
  breakLeeway: 3,
  satTargetHours: 4,
  overpay: true,
};

const emp: Employee = {
  id: "e1",
  name: "A",
  deptId: "dispatch",
  afterHours: false,
  joinMonth: "2025-01",
  openingLeave: 0,
  deptAssignments: [
    { deptId: "hr", effectiveFrom: "2025-01-01" },
    { deptId: "dispatch", effectiveFrom: "2026-06-01" },
  ],
};

describe("buildHrToday", () => {
  it("flags missing attendance and bank gaps", () => {
    const s = buildHrToday({
      date: "2026-11-13",
      employees: [emp],
      depts,
      records: {},
      settings,
      bankMissingIds: ["e1"],
    });
    expect(s.missing).toBe(1);
    expect(s.bankMissing).toBe(1);
    expect(s.issues.some((i) => i.kind === "missing")).toBe(true);
    expect(s.issues.some((i) => i.kind === "bank_missing" && i.openTab === "directory")).toBe(true);
  });

  it("uses assigned shift as-of date for late after grace", () => {
    // Before dispatch assignment: HR start 6:00; 6:16 → late
    const records: Record<string, Record<string, DayRec>> = {
      "2026-05-15": {
        e1: { ...emptyRec(), in: 376, out: 960 },
      },
    };
    const s = buildHrToday({
      date: "2026-05-15",
      employees: [emp],
      depts,
      records,
      settings,
    });
    expect(s.lateAfterGrace).toBe(1);
    expect(s.issues.some((i) => i.kind === "late")).toBe(true);
  });
});

describe("hrTodaySyncLabel", () => {
  it("maps local-only and full HrSyncUi statuses via Batch 1 labels", () => {
    expect(hrTodaySyncLabel({ previewIsolated: false, localOnly: true, status: "synced" })).toBe(
      "Sign In Required",
    );
    expect(hrTodaySyncLabel({ previewIsolated: false, localOnly: false, status: "synced" })).toBe(
      "Cloud Saved",
    );
    expect(hrTodaySyncLabel({ previewIsolated: false, localOnly: false, status: "error" })).toBe(
      "Connection Error",
    );
    expect(hrTodaySyncLabel({ previewIsolated: false, localOnly: false, status: "conflict" })).toBe(
      "Not Synced",
    );
    expect(hrTodaySyncLabel({ previewIsolated: false, localOnly: false, status: "paused" })).toBe(
      "Sign In Required",
    );
    expect(hrTodaySyncLabel({ previewIsolated: false, localOnly: false, status: "unsynced" })).toBe(
      "Not Synced",
    );
  });
});
