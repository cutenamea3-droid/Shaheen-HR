import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useHrAuditHistory } from "@/admin/lib/hr-audit-history";
import { useBonusStore } from "@/admin/lib/bonus-store";
import {
  consistencyDays,
  streakDays,
  studyMinutesInRange,
  usePersonal,
} from "@/personal/lib/store";

describe("Personal UI / audit / bonus / session helper guards", () => {
  it("Personal study surfaces coerce courses/notes/sessions before map/filter", () => {
    for (const rel of [
      "src/personal/components/Courses.tsx",
      "src/personal/components/Backlog.tsx",
      "src/personal/components/Notes.tsx",
      "src/personal/components/Assessments.tsx",
      "src/personal/components/Analytics.tsx",
      "src/personal/components/Focus.tsx",
      "src/personal/components/Vault.tsx",
      "src/personal/components/Timetable.tsx",
      "src/dispatch/components/UserAdmin.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src).toMatch(/Array\.isArray\(/);
    }
  });

  it("hr-audit-history merge and forMonth tolerate non-array events", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/hr-audit-history.ts"), "utf8");
    expect(src).toMatch(/merge:\s*\(persisted, current\)/);
    useHrAuditHistory.setState({ events: null as unknown as [] });
    expect(() => useHrAuditHistory.getState().forMonth("2026-11")).not.toThrow();
    expect(useHrAuditHistory.getState().forMonth("2026-11")).toEqual([]);
    expect(() =>
      useHrAuditHistory.getState().record({ who: "HR", kind: "reminder_add", detail: "x" }),
    ).not.toThrow();
  });

  it("bonus-store forMonth/upsert tolerate corrupt bonuses", () => {
    useBonusStore.setState({ bonuses: "bad" as unknown as [] });
    expect(useBonusStore.getState().forMonth("2026-11")).toEqual([]);
    expect(useBonusStore.getState().upsertBonus("e1", "2026-11", 100).ok).toBe(true);
    expect(Array.isArray(useBonusStore.getState().bonuses)).toBe(true);
  });

  it("session analytics helpers coerce non-array sessions", () => {
    expect(studyMinutesInRange(null as unknown as [], 0, Date.now())).toBe(0);
    expect(consistencyDays(undefined as unknown as [], 14)).toBe(0);
    expect(streakDays({ bad: true } as unknown as [])).toBe(0);
  });

  it("Personal grade/examPrep mutations heal non-arrays", () => {
    usePersonal.setState({
      gradeEntries: null as unknown as [],
      examPrepTasks: "x" as unknown as [],
    });
    expect(() =>
      usePersonal.getState().upsertGradeEntry({
        id: "g1",
        courseId: "c1",
        label: "Quiz",
        score: 10,
        maxScore: 10,
        provenance: "owner_recorded",
        notes: "",
        updatedAt: 1,
      }),
    ).not.toThrow();
    expect(Array.isArray(usePersonal.getState().gradeEntries)).toBe(true);
    expect(() =>
      usePersonal.getState().upsertExamPrepTask({
        id: "t1",
        courseId: "c1",
        examKind: "midterm",
        label: "Revise",
        done: false,
        notes: "",
      }),
    ).not.toThrow();
    expect(Array.isArray(usePersonal.getState().examPrepTasks)).toBe(true);
  });
});
