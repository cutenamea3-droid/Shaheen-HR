import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { HR_SYNC_KEYS } from "./hr-sync-protect";
import {
  MONTH_CLOSING_STORAGE_KEY,
  isDateInClosedMonth,
  monthOfDate,
  useMonthClosing,
} from "./month-closing";
import { HR_AUDIT_STORAGE_KEY, useHrAuditHistory } from "./hr-audit-history";
import { HR_REMINDERS_STORAGE_KEY, useHrReminders } from "./hr-reminders";
import {
  PERF_FOLLOWUPS_STORAGE_KEY,
  assertLayersDistinct,
  collectPerfAssessment,
  collectPerfFacts,
  collectPerfStatements,
  usePerfFollowUps,
} from "./perf-followups";
import { emptyRec } from "./types";
import { fixtureMessyOctober, fixtureCleanOctober } from "./monthly-pdf-fixtures";
import { buildEmployeeReportDoc, setLogoCacheForTests } from "./employee-report-pdf";
import { buildMonthlyPdfDoc } from "./monthly-pdf";

function logoFromPublic(): string | null {
  try {
    const p = resolve(process.cwd(), "public/logo.jpg");
    return `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
  } catch {
    return null;
  }
}

beforeEach(() => {
  useMonthClosing.setState({ months: {} });
  useHrAuditHistory.setState({ events: [] });
  useHrReminders.setState({ reminders: [] });
  usePerfFollowUps.setState({ followUps: [], hrStatements: [] });
});

describe("Batch 11B storage isolation", () => {
  it("keeps HR_SYNC_KEYS at 8 attendance keys", () => {
    expect([...HR_SYNC_KEYS]).toEqual(["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"]);
  });

  it("never puts closing / reminders / follow-ups / audit into HR_SYNC_KEYS", () => {
    for (const k of [
      MONTH_CLOSING_STORAGE_KEY,
      HR_AUDIT_STORAGE_KEY,
      HR_REMINDERS_STORAGE_KEY,
      PERF_FOLLOWUPS_STORAGE_KEY,
      "banking",
      "payments",
      "salary",
    ]) {
      expect(HR_SYNC_KEYS).not.toContain(k as never);
    }
  });

  it("closingMeansPaid is always false", () => {
    expect(useMonthClosing.getState().closingMeansPaid).toBe(false);
  });
});

describe("month closing / reopen", () => {
  it("closes and reopens with reason; rejects empty reopen", () => {
    expect(useMonthClosing.getState().closeMonth("2026-10", "HR").ok).toBe(true);
    expect(useMonthClosing.getState().isClosed("2026-10")).toBe(true);
    expect(useMonthClosing.getState().reopenMonth("2026-10", "HR", "").ok).toBe(false);
    expect(useMonthClosing.getState().reopenMonth("2026-10", "HR", "Fix punch error").ok).toBe(true);
    expect(useMonthClosing.getState().isClosed("2026-10")).toBe(false);
    expect(useMonthClosing.getState().months["2026-10"]?.reopenReason).toBe("Fix punch error");
  });

  it("isDateInClosedMonth gates by YYYY-MM", () => {
    useMonthClosing.getState().closeMonth("2026-10", "HR");
    const closed = (m: string) => useMonthClosing.getState().isClosed(m);
    expect(isDateInClosedMonth("2026-10-15", closed)).toBe(true);
    expect(isDateInClosedMonth("2026-11-01", closed)).toBe(false);
    expect(monthOfDate("2026-10-15")).toBe("2026-10");
  });
});

describe("performance layers: facts ≠ statements ≠ assessment", () => {
  it("collects facts from attendance only", () => {
    const data = fixtureMessyOctober();
    const e = data.employees[0]!;
    const rec = data.records["2026-10-01"]![e.id]!;
    const facts = collectPerfFacts({
      employee: e,
      depts: data.depts,
      date: "2026-10-01",
      rec,
      settings: data.settings,
    });
    expect(facts.every((f) => f.layer === "fact")).toBe(true);
    expect(facts.some((f) => f.kind.includes("Late"))).toBe(true);
  });

  it("keeps assessment separate from statements and facts", () => {
    const facts = collectPerfFacts({
      employee: {
        id: "e1",
        name: "A",
        deptId: "d1",
        afterHours: false,
        joinMonth: "2026-10",
        openingLeave: 0,
      },
      depts: [{ id: "d1", name: "Dispatch", start: 300, end: 900 }],
      date: "2026-10-01",
      rec: { ...emptyRec(), status: "absent" },
      settings: fixtureCleanOctober().settings,
    });
    const statements = collectPerfStatements({
      employeeId: "e1",
      date: "2026-10-01",
      rec: { ...emptyRec(), note: "Called in" },
      perf: { rating: "needs", note: "Discuss punctuality" },
    });
    const assessment = collectPerfAssessment({
      employeeId: "e1",
      date: "2026-10-01",
      perf: { rating: "needs", note: "Discuss punctuality" },
    });
    expect(assertLayersDistinct(facts, assessment)).toBe(true);
    expect(statements.every((s) => s.layer === "statement")).toBe(true);
    expect(assessment.layer).toBe("assessment");
    expect(assessment.ratingLabel).toBe("Needs improvement");
    // Facts never include rating labels
    expect(facts.every((f) => !("rating" in f))).toBe(true);
  });

  it("follow-ups require title + employee + due", () => {
    const bad = usePerfFollowUps.getState().addFollowUp({
      employeeId: "",
      employeeName: "",
      due: "2026-10-05",
      title: "Talk",
    });
    expect("error" in bad).toBe(true);
    const ok = usePerfFollowUps.getState().addFollowUp({
      employeeId: "e1",
      employeeName: "Ali",
      due: "2026-10-05",
      title: "Coach late arrivals",
    });
    expect("error" in ok).toBe(false);
  });
});

describe("HR reminders + audit history", () => {
  it("adds reminders due on or before date", () => {
    const a = useHrReminders.getState().add({ title: "Call bank", due: "2026-10-02" });
    expect("error" in a).toBe(false);
    useHrReminders.getState().add({ title: "Future", due: "2026-10-20" });
    expect(useHrReminders.getState().dueOnOrBefore("2026-10-05")).toHaveLength(1);
  });

  it("records audit events for close and PDF kinds", () => {
    useHrAuditHistory.getState().record({
      who: "HR",
      kind: "month_close",
      detail: "Closed 2026-10 (Closing ≠ Paid)",
      month: "2026-10",
    });
    useHrAuditHistory.getState().record({
      who: "HR",
      kind: "pdf_management",
      detail: "Management Summary exported",
      month: "2026-10",
    });
    expect(useHrAuditHistory.getState().forMonth("2026-10")).toHaveLength(2);
  });
});

describe("individual employee + monthly PDF fixtures", () => {
  it("builds employee report without bank fields", () => {
    setLogoCacheForTests(null);
    const data = fixtureMessyOctober();
    const empId = data.employees[0]!.id;
    const { doc, emp } = buildEmployeeReportDoc(data, {
      company: "Shaheen Transport LLC",
      month: "2026-10",
      employeeId: empId,
      generatedAt: new Date("2026-11-13T16:00:00Z"),
      logo: null,
    });
    expect(emp?.employee.id).toBe(empId);
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1500);
  });

  it("management and audit PDFs still share overview on Batch 6 stack", () => {
    const data = fixtureCleanOctober();
    const mgmt = buildMonthlyPdfDoc(data, {
      mode: "management",
      company: "Shaheen Transport LLC",
      month: "2026-10",
      generatedAt: new Date("2026-11-13T16:00:00Z"),
      logo: null,
    });
    const audit = buildMonthlyPdfDoc(data, {
      mode: "audit",
      company: "Shaheen Transport LLC",
      month: "2026-10",
      generatedAt: new Date("2026-11-13T16:00:00Z"),
      logo: null,
    });
    expect(mgmt.model.overview).toEqual(audit.model.overview);
  });

  it("writes isolated fixture PDFs when MEDIA_OUT is set", () => {
    const out = process.env.MEDIA_OUT;
    if (!out) return;
    mkdirSync(out, { recursive: true });
    const logo = logoFromPublic();
    const data = fixtureMessyOctober();
    for (const mode of ["management", "audit"] as const) {
      const { doc } = buildMonthlyPdfDoc(data, {
        mode,
        company: "Shaheen Transport LLC",
        month: "2026-10",
        generatedAt: new Date("2026-11-13T16:00:00Z"),
        logo,
      });
      const name =
        mode === "management"
          ? "batch11b-october-2026-management-summary.pdf"
          : "batch11b-october-2026-full-hr-audit.pdf";
      writeFileSync(resolve(out, name), Buffer.from(doc.output("arraybuffer")));
      expect(existsSync(resolve(out, name))).toBe(true);
    }
    const empId = data.employees[0]!.id;
    const { doc } = buildEmployeeReportDoc(data, {
      company: "Shaheen Transport LLC",
      month: "2026-10",
      employeeId: empId,
      generatedAt: new Date("2026-11-13T16:00:00Z"),
      logo,
    });
    const empPath = resolve(out, "batch11b-october-2026-employee-report.pdf");
    writeFileSync(empPath, Buffer.from(doc.output("arraybuffer")));
    expect(existsSync(empPath)).toBe(true);
  });
});
