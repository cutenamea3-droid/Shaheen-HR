import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useApp } from "@/admin/lib/store";
import { useHrReminders } from "@/admin/lib/hr-reminders";
import { usePersonal } from "@/personal/lib/store";
import { buildVuSeed } from "@/personal/lib/vu-import";

describe("Admin UI roster coerce + store mutation / reminder / VU notes guards", () => {
  it("Admin HR surfaces coerce employees/depts before map/filter", () => {
    for (const rel of [
      "src/admin/components/hr/Reports.tsx",
      "src/admin/components/hr/Team.tsx",
      "src/admin/components/hr/Performance.tsx",
      "src/admin/components/hr/MyHrToday.tsx",
      "src/admin/components/hr/LeaveManagement.tsx",
      "src/admin/components/hr/Overview.tsx",
      "src/admin/components/hr/Overtime.tsx",
      "src/admin/components/hr/Settings.tsx",
      "src/admin/components/hr/ExpensesManagement.tsx",
      "src/admin/components/hr/SalaryPayments.tsx",
      "src/admin/components/hr/PayrollVerify.tsx",
      "src/admin/components/hr/TeamManagement.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src).toMatch(/Array\.isArray\(/);
    }
  });

  it("Admin store mutations heal corrupt employees/depts and Array.isArray deptAssignments", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/store.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(e\.deptAssignments\)/);
    expect(src).toMatch(/arrOf<Employee>\(s\.employees\)/);
    useApp.setState({ employees: null as unknown as [], depts: "x" as unknown as [] });
    expect(() =>
      useApp.getState().addEmployee({
        name: "Guard Emp",
        deptId: "d1",
        afterHours: false,
        joinMonth: "2026-11",
        openingLeave: 0,
        deptAssignments: "bad" as unknown as [],
      }),
    ).not.toThrow();
    expect(Array.isArray(useApp.getState().employees)).toBe(true);
    expect(useApp.getState().employees.some((e) => e.name === "Guard Emp")).toBe(true);
  });

  it("hr-reminders merge and dueOnOrBefore tolerate non-array reminders", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/hr-reminders.ts"), "utf8");
    expect(src).toMatch(/merge:\s*\(persisted, current\)/);
    useHrReminders.setState({ reminders: null as unknown as [] });
    expect(() => useHrReminders.getState().dueOnOrBefore("2026-11-17")).not.toThrow();
    expect(useHrReminders.getState().dueOnOrBefore("2026-11-17")).toEqual([]);
  });

  it("Personal upsertNote/upsertCourse heal corrupt arrays", () => {
    usePersonal.setState({ notes: "nope" as unknown as [], courses: null as unknown as [] });
    expect(() =>
      usePersonal.getState().upsertNote({
        id: "n-guard",
        courseId: "general",
        title: "t",
        body: "b",
        updatedAt: 1,
        tags: [],
      }),
    ).not.toThrow();
    expect(Array.isArray(usePersonal.getState().notes)).toBe(true);
    expect(() =>
      usePersonal.getState().upsertCourse({
        id: "c-guard",
        code: "CS101",
        title: "Intro",
        lecturesTotal: null,
        lecturesDone: null,
        notes: "",
        isTbd: false,
        requirementType: "Required",
      }),
    ).not.toThrow();
    expect(Array.isArray(usePersonal.getState().courses)).toBe(true);
  });

  it("buildVuSeed only spreads real note arrays (not string .length)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/vu-import.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(prog\?\.notes\)/);
    expect(src).not.toMatch(/prog\?\.notes\?\.length\) notesParts\.push\(\.\.\.prog\.notes\)/);
    expect(() => buildVuSeed()).not.toThrow();
  });
});
