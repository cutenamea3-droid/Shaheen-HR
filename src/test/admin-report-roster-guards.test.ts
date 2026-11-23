import { describe, expect, it } from "vitest";
import { dailyAttendance, payrollSummary } from "@/admin/lib/reports";
import { buildMonthlyReportModel, verifyMonthlyTotals } from "@/admin/lib/monthly-report-model";
import { buildHrToday } from "@/admin/lib/hr-today";
import { leaveRoster } from "@/admin/lib/leave-management";
import { buildWeeklyStats } from "@/personal/lib/weekly-review";
import type { Data } from "@/admin/lib/reports";

const emptySettings = {
  company: "Test",
  grace: 10,
  breakMin: 60,
  breakLeeway: 5,
  satTargetHours: 5,
  overpay: false,
} as Data["settings"];

describe("Admin report / HR today / weekly stats roster guards", () => {
  it("reports tolerate corrupt employees/depts/records", () => {
    const broken = {
      employees: null,
      depts: "nope",
      records: [],
      perf: null,
      settings: emptySettings,
    } as unknown as Data;
    expect(() => dailyAttendance(broken, "2026-11-01")).not.toThrow();
    expect(() => payrollSummary(broken, "2026-11-01", "2026-11-30")).not.toThrow();
    expect(() => buildMonthlyReportModel(broken, "2026-11")).not.toThrow();
    expect(() =>
      verifyMonthlyTotals(broken, "2026-11", buildMonthlyReportModel(broken, "2026-11")),
    ).not.toThrow();
  });

  it("buildHrToday and leaveRoster tolerate missing arrays", () => {
    expect(() =>
      buildHrToday({
        date: "2026-11-01",
        employees: null as unknown as [],
        depts: undefined as unknown as [],
        records: [] as unknown as Record<string, never>,
        settings: emptySettings,
        bankMissingIds: { bad: true } as unknown as string[],
      }),
    ).not.toThrow();
    expect(leaveRoster(null as unknown as [], {}, "2026-11-01")).toEqual([]);
  });

  it("buildHrToday coerces object employee names for React-safe issue rows", () => {
    const summary = buildHrToday({
      date: "2026-11-01",
      employees: [{ id: "e1", name: { n: "A" } as unknown as string, deptId: "d1", joinDate: "2020-01-01" }] as never,
      depts: [],
      records: {},
      settings: emptySettings,
    });
    expect(summary.issues.every((i) => typeof i.name === "string")).toBe(true);
    expect(summary.issues[0]?.name).toContain("object");
  });

  it("buildWeeklyStats coerces sessions/discipline/assessments", () => {
    expect(() =>
      buildWeeklyStats(
        "2026-11-10",
        null as unknown as [],
        { bad: true } as unknown as [],
        undefined as unknown as [],
      ),
    ).not.toThrow();
  });
});
