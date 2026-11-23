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
    expect(analyticsUi).toMatch(/normalizeWeeklyReview\(/);
    expect(analyticsUi).toMatch(/useState\(asTxt\(review\.wins\)\)/);
    expect(analyticsUi).toMatch(/value=\{asTxt\(wins\)\}/);
    expect(analyticsUi).toMatch(/value=\{asTxt\(gLabel\)\}/);
    expect(vaultUi).toMatch(/value=\{asTxt\(vaultNotes\)\}/);
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
    expect(userAdmin).toMatch(/value=\{asText\(a\.role\) === "admin"/);
    expect(teamUi).toMatch(/value=\{asText\(m\.role\) === "admin"/);
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
    expect(expensesUi).toMatch(/value=\{asText\(form\.title\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(form\.note\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(form\.status\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(e\.status\)\}/);
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
    expect(payrollUi).toMatch(/asText\(line\.gate\.message\)/);
    expect(payrollUi).toMatch(/asText\(line\.detail\)/);
    const directoryUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    expect(directoryUi).toMatch(/\{asText\(i\.name\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(form\.accountTitle\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(form\.accountRef\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(form\.note\)\}/);
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
    expect(complianceTeam).toMatch(/value=\{asText\(member\.role\) === "admin"/);
    const recordsUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/Records.tsx"),
      "utf8",
    );
    expect(recordsUi).toMatch(/\{asText\(p\.name\)\}/);
    const driverCardsUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"),
      "utf8",
    );
    expect(driverCardsUi).toMatch(/const safeName = name == null/);
    expect(driverCardsUi).toMatch(/\{safeName\.trim\(\)\}/);
    expect(dispatchApp).toMatch(/asFormText\(c\.summary\)/);
    expect(dispatchApp).toMatch(/asFormText\(c\.notes\)/);
    expect(dispatchApp).toMatch(/asFormText\(h\.summary\)/);
    expect(dispatchApp).toMatch(/asFormText\(c\.kind\)/);
    expect(dispatchApp).toMatch(/asFormText\(ex\.kind\)/);
    expect(dispatchApp).toMatch(/asFormText\(issue\.senior_informed_note\)/);
    expect(dispatchApp).toMatch(/asFormText\(row\.role\)/);
    const auditHistUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/AuditHistory.tsx"),
      "utf8",
    );
    expect(auditHistUi).toMatch(/\{asText\(e\.detail\)\}/);
    expect(auditHistUi).toMatch(/\{asText\(e\.who\)\}/);
    expect(complianceTeam).toMatch(/asText\(target\.email\)/);
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
    expect(followUpUi).toMatch(/\{asText\(fu\.status\)\}/);
    expect(followUpUi).toMatch(/value=\{asText\(fu\.status\)\}/);
    expect(attendanceUi).toMatch(/\{asText\(r\.status\)\}/);
    expect(attendanceUi).toMatch(/value=\{asText\(r\.status\)\}/);
    expect(overtimeUi).toMatch(/\{asText\(r\.status\)\}/);
    const salaryPayUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/SalaryPayments.tsx"),
      "utf8",
    );
    expect(salaryPayUi).toMatch(/value=\{asText\(p\.status\)\}/);
    expect(salaryPayUi).toMatch(/\{asText\(p\.month\)\}/);
    const closeoutLib = readFileSync(
      resolve(process.cwd(), "src/dispatch/lib/closeout.ts"),
      "utf8",
    );
    expect(closeoutLib).toMatch(/Issue: \$\{asTrimmedText\(i\.title\)\}/);
    const alertStripUi = readFileSync(
      resolve(process.cwd(), "src/personal/components/AlertStrip.tsx"),
      "utf8",
    );
    expect(alertStripUi).toMatch(/\{asTxt\(todo\.title\)\}/);
    const drugRecordsUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRecordsPage.tsx"),
      "utf8",
    );
    expect(drugRecordsUi).toMatch(/\{asDrugText\(viewRow\.driverName\)\}/);
    expect(drugRecordsUi).toMatch(/asDrugText\(row\.driverName\)/);
    expect(closeoutLib).toMatch(/Load created · \$\{asTrimmedText\(load\.load_number\)\}/);
    const expensesStore = readFileSync(
      resolve(process.cwd(), "src/admin/lib/expenses-store.ts"),
      "utf8",
    );
    expect(expensesStore).toMatch(/asText\(row\.title\)/);
    expect(notesUi).toMatch(/\{asTxt\(s\.reason\)\}/);
    expect(notesUi).toMatch(/\{asTxt\(s\.courseCode\)\}/);
    const empPdf = readFileSync(
      resolve(process.cwd(), "src/admin/lib/employee-report-pdf.ts"),
      "utf8",
    );
    expect(empPdf).toMatch(/asText\(emp\.employee\.name\)/);
    const quickFind = readFileSync(resolve(process.cwd(), "src/lib/quick-find.ts"), "utf8");
    expect(quickFind).toMatch(/asN\(d\.name\)/);
    const personalStore = readFileSync(
      resolve(process.cwd(), "src/personal/lib/store.ts"),
      "utf8",
    );
    expect(personalStore).toMatch(/Study block · \$\{asText\(c\.code\)\}/);
    const vuPlan = readFileSync(resolve(process.cwd(), "src/personal/lib/vu-plan.ts"), "utf8");
    expect(vuPlan).toMatch(/const title = asText\(t\.title\)/);
    const dispatchCloud = readFileSync(
      resolve(process.cwd(), "src/dispatch/lib/cloud.ts"),
      "utf8",
    );
    expect(dispatchCloud).toMatch(/Cannot cancel a \$\{asText\(load\.status\)\}/);
    expect(opsBoards).toMatch(/\{asText\(l\.load_number\)\}/);
    expect(opsBoards).toMatch(/\{asText\(load\.load_number\)\}/);
    expect(opsBoards).toMatch(/value=\{asText\(load\[field\]\)\}/);
    expect(opsBoards).toMatch(/BOL \{asText\(load\.bol_status\)\}/);
    const closeoutBoards = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/CloseoutBoards.tsx"),
      "utf8",
    );
    expect(closeoutBoards).toMatch(/\{asText\(l\.load_number\)\}/);
    const defaultsLib = readFileSync(
      resolve(process.cwd(), "src/personal/lib/defaults.ts"),
      "utf8",
    );
    expect(defaultsLib).toMatch(/pomodoroFocus: asNum\(/);
    expect(defaultsLib).toMatch(/midtermRef: asStr\(raw\.midtermRef/);
    expect(defaultsLib).toMatch(/finalsRef: asStr\(raw\.finalsRef/);
    expect(defaultsLib).toMatch(/studentLabel: asStr\(raw\.studentLabel/);
    expect(vaultUi).toMatch(/Number\.isFinite\(settings\.weekdayMinutes\)/);
    const rateCardUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/RateCardPanel.tsx"),
      "utf8",
    );
    expect(rateCardUi).toMatch(/const safeValue = value == null/);
    expect(coursesUi).toMatch(/title=\{asTxt\(c\.title\)\}/);
    expect(coursesUi).toMatch(/notes=\{asTxt\(c\.notes\)\}/);
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
    expect(closeoutUi).toMatch(/value=\{asText\(a\.status\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.customer_name\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.load_number\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.status\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.payment_status\)\}/);
    expect(assessmentsUi).toMatch(/\{asTxt\(badge\.label\)\}/);
    expect(assessmentsUi).toMatch(/useState\(asTxt\(settings\.midtermRef\)\)/);
    const opsLib = readFileSync(
      resolve(process.cwd(), "src/dispatch/lib/ops-controls.ts"),
      "utf8",
    );
    expect(opsLib).toMatch(/asTs\(l\.load_number\)/);
    expect(opsLib).toMatch(/asTs\(i\.title\)/);
    expect(opsLib).toMatch(/asTs\(f\.title\)/);
    expect(todayUi).toMatch(/hint=\{asTxt\(rx\.math\)\}/);
    expect(attendanceUi).toMatch(/Number\.isFinite\(r\.otHours\)/);
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
    expect(dashUi).toMatch(/typeof raw === "string" \? raw : String\(raw\)\)\.trim\(\)/);
    const drugFormUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestForm.tsx"),
      "utf8",
    );
    expect(drugFormUi).toMatch(/const asDrugText = /);
    expect(drugFormUi).toMatch(/useState\(asDrugText\(initial\?\.specimenId\)\)/);
    expect(drugFormUi).toMatch(/testingEventId: asDrugText\(testingEventId\)/);
    const drugRegUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/DrugTestRegister.tsx"),
      "utf8",
    );
    expect(drugRegUi).toMatch(/asDrugText\(draft\.testingEventId\)\.trim\(\)/);
    const rosterLib = readFileSync(
      resolve(process.cwd(), "src/lib/driver-hr/roster-drivers.ts"),
      "utf8",
    );
    expect(rosterLib).toMatch(/typeof r\.driverId === "string"/);
    expect(dispatchApp).toMatch(/\{asFormText\(load\.load_number\)\}/);
    expect(src).toMatch(/normalizeFocusSession\(\{/);
    expect(src).toMatch(/normalizeGradeEntry\(g\)/);
    expect(src).toMatch(/normalizeCourseGrade\(g\)/);
    expect(src).toMatch(/normalizeExamPrepTask\(t\)/);
    expect(src).toMatch(/normalizeWeeklyReview\(r,/);
    expect(src).toMatch(/typeof vaultNotes === "string" \? vaultNotes : String\(vaultNotes\)/);
    expect(src).toMatch(/typeof raw\.vaultNotes === "string"\s*\?\s*raw\.vaultNotes\s*:\s*String\(raw\.vaultNotes\)/);
    expect(notesUi).toMatch(/value=\{asTxt\(title\)\}/);
    expect(notesUi).toMatch(/value=\{asTxt\(body\)\}/);
    expect(assessmentsUi).toMatch(/value=\{asTxt\(title\)\}/);
    expect(backlogUi).toMatch(/value=\{asTxt\(label\)\}/);
    expect(focusUi).toMatch(/value=\{asTxt\(lessonLabel\)\}/);
    expect(focusUi).toMatch(/key=\{asTxt\(c\.id\)\} value=\{asTxt\(c\.id\)\}/);
    expect(opsBoards).toMatch(/asText\(l\.equipment\)/);
    expect(assessmentsUi).toMatch(/value=\{asTxt\(prepLabel\)\}/);
    expect(tasksUi).toMatch(/value=\{asText\(title\)\}/);
    expect(tasksUi).toMatch(/value=\{asText\(due\)\}/);
    const hireUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/driver-hr/HireDateField.tsx"),
      "utf8",
    );
    expect(hireUi).toMatch(/const safeDraft = asHireText\(draft\)/);
    expect(dispatchApp).toMatch(/key=\{asFormText\(d\.id\)\} value=\{asFormText\(d\.id\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.bol_status\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.pod_status\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.assigned_driver_id\)\}/);
    expect(dispatchApp).toMatch(/key=\{asFormText\(l\.id\)\} value=\{asFormText\(l\.id\)\}/);
    expect(closeoutUi).toMatch(/value=\{asText\(description\)\}/);
    expect(closeoutUi).toMatch(/key=\{asText\(l\.id\)\} value=\{asText\(l\.id\)\}/);
    expect(salaryPayUi).toMatch(/value=\{asText\(month\)\}/);
    expect(reportsUi).toMatch(/value=\{asText\(reopenReason\)\}/);
    expect(reportsUi).toMatch(/value=\{asText\(empId\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(form\.institutionId\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(form\.effectiveFrom\)\}/);
    expect(opsBoards).toMatch(/value=\{asText\(loadId\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(status\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(driverId\)\}/);
    expect(dispatchApp).toMatch(/asFormText\(form\.cancel_reason\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(form\.reschedule_note\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(form\.closeout_note\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(form\.reopen_reason\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(form\.load_number\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(draft\.location\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(form\.planned_pickup_at\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(stop\.stop_type\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(form\.categoryId\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(form\.scope\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(statusFilter\)\}/);
    expect(closeoutUi).toMatch(/asText\(description\)\.trim\(\)/);
    expect(opsBoards).toMatch(/asText\(title\)\.trim\(\)/);
    expect(opsBoards).toMatch(/value=\{asText\(title\)\}/);
    expect(hrTodayUi).toMatch(/asText\(remTitle\)\.trim\(\)/);
    expect(hrTodayUi).toMatch(/value=\{asText\(remTitle\)\}/);
    expect(hrTodayUi).toMatch(/value=\{asText\(remEmp\)\}/);
    expect(perfUi).toMatch(/asText\(fuTitle\)\.trim\(\)/);
    expect(perfUi).toMatch(/value=\{asText\(fuEmp\)\}/);
    expect(perfUi).toMatch(/value=\{asText\(p\.rating\)\}/);
    expect(teamEmpUi).toMatch(/asText\(name\)\.trim\(\)/);
    expect(teamEmpUi).toMatch(/value=\{asText\(deptId\)\}/);
    expect(payrollUi).toMatch(/asText\(dayRateDraft\)\.trim\(\)/);
    expect(payrollUi).toMatch(/value=\{asText\(dayRateDraft\)\}/);
    expect(followUpUi).toMatch(/asText\(draftSubject\)\.trim\(\)/);
    expect(followUpUi).toMatch(/value=\{asText\(draftSubject\)\}/);
    expect(leaveUi).toMatch(/value=\{asText\(month\)\}/);
    expect(reportsUi).toMatch(/value=\{asText\(month\)\}/);
    expect(reportsUi).toMatch(/value=\{asText\(from\)\}/);
    expect(attendanceUi).toMatch(/value=\{asText\(date\)\}/);
    expect(attendanceUi).toMatch(/value=\{asText\(rangeFrom\)\}/);
    expect(attendanceUi).toMatch(/value=\{asText\(rangeTo\)\}/);
    expect(payrollUi).toMatch(/value=\{asText\(month\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(q\)\}/);
    expect(directoryUi).toMatch(/value=\{asText\(instQuery\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(customCat\)\}/);
    expect(expensesUi).toMatch(/value=\{asText\(finEmpId\)\}/);
    expect(expensesUi).toMatch(/asText\(budgetLimit\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(statusFilter\)\}/);
    expect(closeoutUi).toMatch(/value=\{asText\(kind\)\}/);
    expect(teamEmpUi).toMatch(/Number\.isFinite\(e\.openingLeave\)/);
    const overviewUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Overview.tsx"),
      "utf8",
    );
    expect(overviewUi).toMatch(/value=\{asText\(date\)\}/);
    expect(auditHistUi).toMatch(/value=\{asText\(month\)\}/);
    expect(drugRegUi).toMatch(/value=\{asDrugText\(q\)\}/);
    expect(drugRegUi).toMatch(/value=\{asDrugText\(statusFilter\)\}/);
    expect(dispatchApp).toMatch(/asFormText\(commSummary\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(checkNotes\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(excKind\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/asFormText\(seniorNote\)\.trim\(\)/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(commSummary\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(summary\)\}/);
    expect(dispatchApp).toMatch(/value=\{asFormText\(email\)\}/);
    expect(teamUi).toMatch(/asText\(name\)\.trim\(\)/);
    expect(teamUi).toMatch(/value=\{asText\(name\)\}/);
    expect(teamUi).toMatch(/value=\{asText\(role\)\}/);
    expect(userAdmin).toMatch(/asText\(displayName\)\.trim\(\)/);
    expect(userAdmin).toMatch(/value=\{asText\(displayName\)\}/);
    expect(userAdmin).toMatch(/value=\{asText\(role\)\}/);
    expect(recordsUi).toMatch(/asText\(name\)\.trim\(\)/);
    expect(recordsUi).toMatch(/value=\{asText\(q\)\}/);
    expect(recordsUi).toMatch(/value=\{asText\(name\)\}/);
    expect(recordsUi).toMatch(/value=\{asText\(doc\)\}/);
    expect(followUpUi).toMatch(/value=\{asText\(search\)\}/);
    expect(complianceTeam).toMatch(/asText\(name\)\.trim\(\)/);
    expect(complianceTeam).toMatch(/value=\{asText\(name\)\}/);
    expect(lockGate).toMatch(/asText\(email\)\.trim\(\)/);
    expect(lockGate).toMatch(/value=\{asText\(email\)\}/);
    expect(dashboardUi).toMatch(/value=\{asText\(q\)\}/);
    expect(dashboardUi).toMatch(/!asText\(q\)\.trim\(\)/);
    expect(driverCardsUi).toMatch(/value=\{asText\(q\)\}/);
    expect(driverCardsUi).toMatch(/asText\(q\)\.trim\(\)/);
    expect(dataTableUi).toMatch(/value=\{asText\(q\)\}/);
    expect(dataTableUi).toMatch(/if \(asText\(q\)\.trim\(\)\)/);
    const dispatchLogin = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/LoginGate.tsx"),
      "utf8",
    );
    expect(dispatchLogin).toMatch(/asText\(email\)\.trim\(\)/);
    expect(dispatchLogin).toMatch(/value=\{asText\(email\)\}/);
    expect(dqUi).toMatch(/value=\{asText\(q\)\}/);
    expect(coursesUi).toMatch(/value=\{asTxt\(codeV\)\}/);
    expect(coursesUi).toMatch(/value=\{asTxt\(titleV\)\}/);
    expect(assessmentsUi).toMatch(/value=\{asTxt\(prepKind\)\}/);
    expect(assessmentsUi).toMatch(/value=\{asTxt\(kind\)\}/);
    expect(focusUi).toMatch(/value=\{asTxt\(activityKind\)\}/);
    expect(focusUi).toMatch(/value=\{asTxt\(mode\)\}/);
    expect(vaultUi).toMatch(/value=\{asTxt\(pw\)\}/);
    expect(vaultUi).toMatch(/asTxt\(pw\) \|\| pwRef/);
    expect(analyticsUi).toMatch(/value=\{asTxt\(letter\)\}/);
    expect(analyticsUi).toMatch(/value=\{asTxt\(gProv\)\}/);
    const acctSettingsUi = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AccountSettings.tsx"),
      "utf8",
    );
    expect(acctSettingsUi).toMatch(/asText\(name\)\.trim\(\)/);
    expect(acctSettingsUi).toMatch(/value=\{asText\(currentPassword\)\}/);
    expect(alertsUi).toMatch(/value=\{asText\(search\)\}/);
    expect(tasksUi).toMatch(/value=\{asText\(kind\)\}/);
    const myAccountUi = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/MyAccount.tsx"),
      "utf8",
    );
    expect(myAccountUi).toMatch(/value=\{asText\(current\)\}/);
    expect(myAccountUi).toMatch(/value=\{asText\(pass\)\}/);
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
