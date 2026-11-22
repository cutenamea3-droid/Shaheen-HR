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
