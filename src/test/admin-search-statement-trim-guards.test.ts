import { describe, expect, it } from "vitest";
import { useHrReminders } from "@/admin/lib/hr-reminders";
import { collectPerfStatements, usePerfFollowUps } from "@/admin/lib/perf-followups";
import { useMonthClosing } from "@/admin/lib/month-closing";
import { searchPkInstitutions } from "@/admin/lib/pk-payment-institutions";
import { filterRosterDrivers } from "@/lib/driver-hr/roster-drivers";
import { filterDataQualityFindings } from "@/lib/data-quality";
import { courseIdFromCode } from "@/personal/lib/vu-plan";
import { vuQuickLinks } from "@/personal/lib/vu-rhythm";

describe("admin/search/statement trim coerces", () => {
  it("hr-reminders add coerces non-string title/note", () => {
    useHrReminders.setState({ reminders: [] });
    expect(() =>
      useHrReminders.getState().add({
        title: 42 as unknown as string,
        due: "2026-11-17",
        note: null as unknown as string,
      }),
    ).not.toThrow();
    expect(useHrReminders.getState().reminders[0]?.title).toBe("42");
  });

  it("perf follow-ups / statements coerce non-string title/text/notes", () => {
    usePerfFollowUps.setState({ followUps: [], hrStatements: [] });
    expect(() =>
      usePerfFollowUps.getState().addFollowUp({
        title: 7 as unknown as string,
        employeeId: "e1",
        employeeName: "Alex",
        due: "2026-11-17",
        note: 9 as unknown as string,
      }),
    ).not.toThrow();
    expect(usePerfFollowUps.getState().followUps[0]?.title).toBe("7");
    expect(() =>
      usePerfFollowUps.getState().addHrStatement("e1", "2026-11-17", 55 as unknown as string),
    ).not.toThrow();
    expect(() =>
      collectPerfStatements({
        employeeId: "e1",
        date: "2026-11-17",
        rec: { note: 123 as unknown as string } as never,
        perf: { note: null as unknown as string } as never,
        hrStatements: [{ employeeId: "e1", date: "2026-11-17", text: 55 as unknown as string } as never],
      }),
    ).not.toThrow();
  });

  it("month reopen + PK search + roster/data-quality/VU coerce query scalars", () => {
    useMonthClosing.setState({
      months: {
        "2026-11": {
          month: "2026-11",
          status: "closed",
          closedAt: 1,
          closedBy: "HR",
          reopenReason: "",
          reopenedAt: null,
          reopenedBy: "",
        },
      },
    });
    expect(() => useMonthClosing.getState().reopenMonth("2026-11", "HR", 1 as unknown as string)).not.toThrow();
    expect(searchPkInstitutions(null as unknown as string).length).toBeGreaterThan(0);
    expect(() => searchPkInstitutions(12 as unknown as string)).not.toThrow();
    expect(() =>
      filterRosterDrivers([{ driverId: "d1", name: "Alex" }], 1 as unknown as string),
    ).not.toThrow();
    expect(() =>
      filterDataQualityFindings(
        [{ driverName: "Alex", title: "x", detail: "y", severity: "low" } as never],
        { q: 1 as unknown as string },
      ),
    ).not.toThrow();
    expect(courseIdFromCode(101 as unknown as string)).toBe("101");
    expect(() => vuQuickLinks(202 as unknown as string)).not.toThrow();
  });
});
