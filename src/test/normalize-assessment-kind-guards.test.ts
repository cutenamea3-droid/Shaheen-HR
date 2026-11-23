import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeAssessment,
  normalizeBacklogItem,
  normalizeCourse,
  normalizeCourseGrade,
  normalizeExamPrepTask,
  normalizeFocusSession,
  normalizeGradeEntry,
  normalizeNote,
} from "@/personal/lib/assessment-phases";
import { migrateDiscipline } from "@/personal/lib/defaults";

describe("normalizeAssessment coerce guards", () => {
  it("stringifies corrupt kind/title and never leaves non-string kind", () => {
    const a = normalizeAssessment({
      id: 42 as unknown as string,
      title: 99 as unknown as string,
      kind: 7 as unknown as "quiz",
      dueDate: 20260101 as unknown as string,
    });
    expect(a.id).toBe("42");
    expect(a.title).toBe("99");
    expect(a.kind).toBe("other");
    expect(a.dueDate).toBe("20260101");
    expect(typeof a.kind).toBe("string");
    expect(a.kind.toUpperCase()).toBe("OTHER");
  });

  it("preserves midterm/final kinds and normalizes course/backlog/note scalars", () => {
    expect(normalizeAssessment({ id: "1", title: "M", kind: "midterm" }).kind).toBe("midterm");
    expect(normalizeAssessment({ id: "1", title: "F", kind: "final" }).kind).toBe("final");
    const c = normalizeCourse({
      id: 9 as unknown as string,
      code: 101 as unknown as string,
      title: null as unknown as string,
    });
    expect(c.id).toBe("9");
    expect(c.code).toBe("101");
    expect(c.title).toBe("");
    const b = normalizeBacklogItem({
      id: 3 as unknown as string,
      label: 55 as unknown as string,
      estimatedMinutes: "12" as unknown as number,
    });
    expect(b.id).toBe("3");
    expect(b.label).toBe("55");
    expect(b.estimatedMinutes).toBe(12);
    const n = normalizeNote({
      id: 1 as unknown as string,
      title: 2 as unknown as string,
      body: 3 as unknown as string,
      tags: [4, "ok"] as unknown as string[],
    });
    expect(n.title).toBe("2");
    expect(n.body).toBe("3");
    expect(n.tags).toEqual(["4", "ok"]);
    const prep = normalizeExamPrepTask({
      id: 1 as unknown as string,
      examKind: "MIDTERM" as unknown as "midterm",
      label: 9 as unknown as string,
    });
    expect(prep.examKind).toBe("midterm");
    expect(prep.label).toBe("9");
    const disc = migrateDiscipline([
      { id: "open-vulms", label: "x", doneDates: [20260101 as unknown as string, "2026-01-02"] },
    ]);
    expect(disc.find((d) => d.id === "open-vulms")?.doneDates).toEqual([
      "20260101",
      "2026-01-02",
    ]);
    const sess = normalizeFocusSession({
      id: "s1",
      minutes: "12" as unknown as number,
      startedAt: "100" as unknown as number,
      endedAt: "200" as unknown as number,
      mode: "BUSY" as unknown as "busy",
    });
    expect(sess.minutes).toBe(12);
    expect(sess.mode).toBe("busy");
    expect(sess.startedAt).toBe(100);
    const ge = normalizeGradeEntry({
      id: "g1",
      label: 7 as unknown as string,
      score: "80" as unknown as number,
      maxScore: "100" as unknown as number,
    });
    expect(ge.label).toBe("7");
    expect(ge.score).toBe(80);
    expect(ge.maxScore).toBe(100);
    const cg = normalizeCourseGrade({
      id: "cg1",
      letter: 3 as unknown as string,
      creditHours: "3" as unknown as number,
    });
    expect(cg.letter).toBe("3");
    expect(cg.creditHours).toBe(3);
  });

  it("source keeps kind coerce + revision/attendance/overview/quickfind guards", () => {
    const phases = readFileSync(
      resolve(process.cwd(), "src/personal/lib/assessment-phases.ts"),
      "utf8",
    );
    const rev = readFileSync(resolve(process.cwd(), "src/personal/lib/revision.ts"), "utf8");
    const att = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"),
      "utf8",
    );
    const overview = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Overview.tsx"),
      "utf8",
    );
    const store = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    const courses = readFileSync(
      resolve(process.cwd(), "src/personal/components/Courses.tsx"),
      "utf8",
    );
    expect(phases).toMatch(/KIND_SET\.has\(kindRaw\)/);
    expect(phases).toMatch(/"midterm"/);
    expect(phases).toMatch(/export function normalizeCourse/);
    expect(phases).toMatch(/title: asText\(raw\.title\)/);
    expect(rev).toMatch(/typeof a\.kind === "string" \? a\.kind : String\(a\.kind\)/);
    expect(att).toMatch(/typeof date === "string" \? date : String\(date\)\)\.slice\(0,\s*7\)/);
    expect(overview).toMatch(/typeof date === "string" \? date : String\(date\)\)\.slice\(0,\s*7\)/);
    expect(store).toMatch(/normalizeCourse\(c as Partial<Course>/);
    expect(store).toMatch(/normalizeBacklogItem\(b as Partial<BacklogItem>/);
    expect(store).toMatch(/normalizeNote\(n as Partial<Note>/);
    expect(store).toMatch(/normalizeExamPrepTask\(t as Partial<ExamPrepTask>/);
    expect(store).toMatch(/normalizeFocusSession\(/);
    expect(store).toMatch(/normalizeGradeEntry\(/);
    expect(store).toMatch(/normalizeCourseGrade\(/);
    expect(courses).toMatch(/typeof id === "string" \? id : String\(id\)\)\.toUpperCase\(\)/);
    expect(phases).toMatch(/export function normalizeBacklogItem/);
    expect(phases).toMatch(/export function normalizeNote/);
    expect(phases).toMatch(/export function normalizeExamPrepTask/);
    expect(phases).toMatch(/export function normalizeFocusSession/);
    expect(phases).toMatch(/export function normalizeGradeEntry/);
    expect(phases).toMatch(/export function normalizeCourseGrade/);
  });
});
