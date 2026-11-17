import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVuSeed } from "@/personal/lib/vu-import";
import { VU_STUDY_PLAN, buildTodayPrescription, type VuStudyPlan } from "@/personal/lib/vu-plan";

describe("cloud / VU corrupt-shape guards", () => {
  it("cloudLoad/cloudSave use Array.isArray (not cast-then-??)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/Array\.isArray\(rows\)/);
    expect(src).toMatch(/Array\.isArray\(out\)/);
    expect(src).not.toMatch(/\(rows as unknown as .+\) \?\? \[\]/);
    expect(src).not.toMatch(/\(out as unknown as .+\) \?\? \[\]/);
  });

  it("buildVuSeed tolerates corrupt todos / enrolled / priorityTodos", () => {
    const bad = {
      ...VU_STUDY_PLAN,
      enrolledCourses: null as never,
      todos: { bad: true } as never,
      recovery: { ...VU_STUDY_PLAN.recovery, priorityTodos: "nope" as never },
    } as VuStudyPlan;
    expect(() => buildVuSeed(bad)).not.toThrow();
    const seed = buildVuSeed(bad);
    expect(seed.courses).toEqual([]);
    expect(seed.assessments).toEqual([]);
    // priorityTodos healed empty; CS101 catch-up backlog may still seed from recovery.
    expect(seed.backlog.every((b) => !b.id.startsWith("vu-backlog-0-"))).toBe(true);
  });

  it("buildTodayPrescription tolerates corrupt lecture slots", () => {
    const bad = {
      ...VU_STUDY_PLAN,
      weeklyLectureSchedule: {
        ...VU_STUDY_PLAN.weeklyLectureSchedule,
        slots: null as never,
      },
    } as VuStudyPlan;
    expect(() => buildTodayPrescription(bad, "2026-11-17", { handoutFirst: true })).not.toThrow();
  });
});
