import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePersonal } from "@/personal/lib/store";

describe("Personal store write-path normalize guards", () => {
  it("source wires normalize* on note/backlog/session/grade/exam/weekly writes", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    expect(src).toMatch(/normalizeBacklogItem\(\{/);
    expect(src).toMatch(/normalizeNote\(n\)/);
    const notesUi = readFileSync(resolve(process.cwd(), "src/personal/components/Notes.tsx"), "utf8");
    expect(notesUi).toMatch(/normalizeNote\(n as Partial<Note>/);
    expect(notesUi).toMatch(/asTxt\(n\.title\)/);
    expect(notesUi).toMatch(/asTxt\(n\.body\)/);
    const backlogUi = readFileSync(resolve(process.cwd(), "src/personal/components/Backlog.tsx"), "utf8");
    expect(backlogUi).toMatch(/normalizeBacklogItem\(/);
    expect(backlogUi).toMatch(/asTxt\(b\.label\)/);
    const assessmentsUi = readFileSync(
      resolve(process.cwd(), "src/personal/components/Assessments.tsx"),
      "utf8",
    );
    expect(assessmentsUi).toMatch(/normalizeAssessment\(/);
    expect(assessmentsUi).toMatch(/normalizeExamPrepTask\(/);
    expect(assessmentsUi).toMatch(/asTxt\(a\.title\)/);
    const coursesUi = readFileSync(resolve(process.cwd(), "src/personal/components/Courses.tsx"), "utf8");
    expect(coursesUi).toMatch(/normalizeCourse\(/);
    const focusUi = readFileSync(resolve(process.cwd(), "src/personal/components/Focus.tsx"), "utf8");
    expect(focusUi).toMatch(/normalizeFocusSession\(/);
    expect(focusUi).toMatch(/asTxt\(s\.label\)/);
    const vaultUi = readFileSync(resolve(process.cwd(), "src/personal/components/Vault.tsx"), "utf8");
    expect(vaultUi).toMatch(/asTxt\(d\.label\)/);
    const analyticsUi = readFileSync(
      resolve(process.cwd(), "src/personal/components/Analytics.tsx"),
      "utf8",
    );
    expect(analyticsUi).toMatch(/normalizeGradeEntry\(/);
    expect(analyticsUi).toMatch(/normalizeCourseGrade\(/);
    expect(analyticsUi).toMatch(/asTxt\(g\.letter\)/);
    const teamUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/TeamManagement.tsx"),
      "utf8",
    );
    expect(teamUi).toMatch(/normalizeTeamMember\(/);
    expect(teamUi).toMatch(/\{asText\(m\.email\)\}/);
    const userAdmin = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/UserAdmin.tsx"),
      "utf8",
    );
    expect(userAdmin).toMatch(/healDispatchAccount/);
    expect(userAdmin).toMatch(/asText\(a\.display_name\)/);
    const attendanceUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"),
      "utf8",
    );
    expect(attendanceUi).toMatch(/normalizeEmployee\(/);
    expect(attendanceUi).toMatch(/\{asText\(e\.name\)\}/);
    const overtimeUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Overtime.tsx"),
      "utf8",
    );
    expect(overtimeUi).toMatch(/normalizeEmployee\(/);
    expect(overtimeUi).toMatch(/\{asText\(x\.e\.name\)\}/);
    const dispatchApp = readFileSync(
      resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"),
      "utf8",
    );
    expect(dispatchApp).toMatch(/healRosterDriver/);
    expect(dispatchApp).toMatch(/asFormText\(d\.display_name\)/);
    const opsBoards = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    expect(opsBoards).toMatch(/asText\(row\.driver\.display_name\)/);
    const expensesUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/ExpensesManagement.tsx"),
      "utf8",
    );
    expect(expensesUi).toMatch(/\{asText\(e\.title\)\}/);
    expect(expensesUi).toMatch(/\{asText\(c\.name\)\}/);
    const hrTodayUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/MyHrToday.tsx"),
      "utf8",
    );
    expect(hrTodayUi).toMatch(/\{asText\(issue\.name\)\}/);
    const leaveUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/LeaveManagement.tsx"),
      "utf8",
    );
    expect(leaveUi).toMatch(/\{asText\(row\.name\)\}/);
    const perfUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Performance.tsx"),
      "utf8",
    );
    expect(perfUi).toMatch(/\{asText\(e\.name\)\}/);
    const reportsUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Reports.tsx"),
      "utf8",
    );
    expect(reportsUi).toMatch(/\{asText\(e\.name\)\}/);
    const teamEmpUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Team.tsx"),
      "utf8",
    );
    expect(teamEmpUi).toMatch(/normalizeEmployee\(/);
    expect(teamEmpUi).toMatch(/value=\{asText\(e\.name\)\}/);
    const settingsUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Settings.tsx"),
      "utf8",
    );
    expect(settingsUi).toMatch(/normalizeDept\(/);
    expect(settingsUi).toMatch(/value=\{asText\(d\.name\)\}/);
    const histUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/ComplianceHistoryPanel.tsx"),
      "utf8",
    );
    expect(histUi).toMatch(/\{asText\(d\.name\)\}/);
    expect(focusUi).toMatch(/\{asTxt\(c\.code\)\}/);
    expect(focusUi).toMatch(/\{asTxt\(c\.title\)\}/);
    const timetableUi = readFileSync(
      resolve(process.cwd(), "src/personal/components/Timetable.tsx"),
      "utf8",
    );
    expect(timetableUi).toMatch(/normalizeCourse\(/);
    expect(timetableUi).toMatch(/\{asTxt\(b\.label\)\}/);
    expect(opsBoards).toMatch(/asText\(row\.title\)/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(stop\.name\)\}/);
    const tasksUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Tasks.tsx"),
      "utf8",
    );
    expect(tasksUi).toMatch(/\{asText\(t\.title\)\}/);
    const todayUi = readFileSync(
      resolve(process.cwd(), "src/personal/components/Today.tsx"),
      "utf8",
    );
    expect(todayUi).toMatch(/\{asTxt\(next\.title\)\}/);
    expect(todayUi).toMatch(/\{asTxt\(b\.label\)\}/);
    expect(notesUi).toMatch(/\{asTxt\(c\.code\)\}/);
    expect(backlogUi).toMatch(/\{asTxt\(c\.code\)\}/);
    expect(assessmentsUi).toMatch(/\{asTxt\(c\.code\)\}/);
    const payrollUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/PayrollVerify.tsx"),
      "utf8",
    );
    expect(payrollUi).toMatch(/\{asText\(line\.label\)\}/);
    const directoryUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    expect(directoryUi).toMatch(/\{asText\(i\.name\)\}/);
    const accountUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AccountSettings.tsx"),
      "utf8",
    );
    expect(accountUi).toMatch(/healPortalAccount/);
    expect(accountUi).toMatch(/\{asText\(account\.email\)\}/);
    expect(attendanceUi).toMatch(/value=\{asText\(r\.note\)\}/);
    expect(perfUi).toMatch(/value=\{asText\(p\.note\)\}/);
    expect(expensesUi).toMatch(/\{asText\(a\.detail\)\}/);
    const lockGate = readFileSync(
      resolve(process.cwd(), "src/components/tracker/LockGate.tsx"),
      "utf8",
    );
    expect(lockGate).toMatch(/healPortalAccount\(next\)/);
    const complianceTeam = readFileSync(
      resolve(process.cwd(), "src/components/tracker/TeamManagement.tsx"),
      "utf8",
    );
    expect(complianceTeam).toMatch(/healPortalAccount/);
    expect(complianceTeam).toMatch(/\{asText\(member\.email\)\}/);
    const recordsUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/Records.tsx"),
      "utf8",
    );
    expect(recordsUi).toMatch(/\{asText\(p\.name\)\}/);
    expect(dispatchApp).toMatch(/asFormText\(c\.summary\)/);
    expect(dispatchApp).toMatch(/asFormText\(c\.notes\)/);
    expect(dispatchApp).toMatch(/asFormText\(h\.summary\)/);
    const dashboardUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/Dashboard.tsx"),
      "utf8",
    );
    expect(dashboardUi).toMatch(/\{asText\(u\.name\)\}/);
    expect(dashboardUi).toMatch(/\{asText\(d\.driver\) \|\| "—"\}/);
    const addDriverUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AddDriverDialog.tsx"),
      "utf8",
    );
    expect(addDriverUi).toMatch(/value=\{asText\(base\.name\)\}/);
    const alertsUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AlertsWorkCenter.tsx"),
      "utf8",
    );
    expect(alertsUi).toMatch(/\{asText\(item\.linkOnly\.label\)\}/);
    const dataTableUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DataTable.tsx"),
      "utf8",
    );
    expect(dataTableUi).toMatch(/\{asText\(it\.name\)\}/);
    expect(dataTableUi).toMatch(/asText\(def\.title\)/);
    const followUpUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/FollowUpTracker.tsx"),
      "utf8",
    );
    expect(followUpUi).toMatch(/\{asText\(fu\.driver\)\}/);
    expect(followUpUi).toMatch(/\{asText\(fu\.subject\)\}/);
    const planCalUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/PlanCalendar.tsx"),
      "utf8",
    );
    expect(planCalUi).toMatch(/\{asText\(ev\.title\)\}/);
    const closeoutUi = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/CloseoutBoards.tsx"),
      "utf8",
    );
    expect(closeoutUi).toMatch(/\{asText\(a\.description\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.customer_name\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.load_number\)\}/);
    const fileCompleteUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/FileCompletenessPanel.tsx"),
      "utf8",
    );
    expect(fileCompleteUi).toMatch(/\{asText\(d\.driverName\)\}/);
    const dqUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DataQualityReview.tsx"),
      "utf8",
    );
    expect(dqUi).toMatch(/\{asText\(f\.title\)\}/);
    expect(dqUi).toMatch(/\{asText\(f\.detail\)\}/);
    const inspectionUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/InspectionReadinessPanel.tsx"),
      "utf8",
    );
    expect(inspectionUi).toMatch(/\{asText\(s\.driverName\)\}/);
    expect(inspectionUi).toMatch(/\{asText\(it\.document\)\}/);
    const dashUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/Dashboard.tsx"),
      "utf8",
    );
    expect(dashUi).toMatch(/\{asText\(i\.label\)\}/);
    expect(dashUi).toMatch(/\{asText\(def\.title\)\}/);
    expect(dispatchApp).toMatch(/\{asFormText\(load\.load_number\)\}/);
    expect(src).toMatch(/normalizeFocusSession\(\{/);
    expect(src).toMatch(/normalizeGradeEntry\(g\)/);
    expect(src).toMatch(/normalizeCourseGrade\(g\)/);
    expect(src).toMatch(/normalizeExamPrepTask\(t\)/);
    expect(src).toMatch(/normalizeWeeklyReview\(r,/);
    expect(src).toMatch(/typeof vaultNotes === "string" \? vaultNotes : String\(vaultNotes\)/);
  });

  it("upsertNote / addBacklog / addSession coerce corrupt scalars", () => {
    expect(() =>
      usePersonal.getState().upsertNote({
        id: "n1",
        courseId: "general",
        title: 99 as unknown as string,
        body: null as unknown as string,
        updatedAt: Date.now(),
        tags: [1, "ok"] as unknown as string[],
      }),
    ).not.toThrow();
    const note = usePersonal.getState().notes.find((n) => n.id === "n1");
    expect(typeof note?.title).toBe("string");
    expect(Array.isArray(note?.tags)).toBe(true);

    expect(() =>
      usePersonal.getState().addBacklog({
        courseId: "general",
        label: 12 as unknown as string,
        estimatedMinutes: "x" as unknown as number,
      }),
    ).not.toThrow();
    const bl = usePersonal.getState().backlog.at(-1);
    expect(typeof bl?.label).toBe("string");
    expect(typeof bl?.estimatedMinutes).toBe("number");

    const now = Date.now();
    expect(() =>
      usePersonal.getState().addSession({
        courseId: null,
        minutes: "30" as unknown as number,
        startedAt: now,
        endedAt: now,
        mode: "normal",
        label: 5 as unknown as string,
      }),
    ).not.toThrow();
    const sess = usePersonal.getState().sessions[0];
    expect(typeof sess?.minutes).toBe("number");
    expect(typeof sess?.label).toBe("string");
  });
});
