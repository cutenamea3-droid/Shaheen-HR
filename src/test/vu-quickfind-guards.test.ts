import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeVuTerm } from "@/personal/lib/vu-rhythm";
import { buildVuSeed } from "@/personal/lib/vu-import";
import { buildTodayPrescription, VU_STUDY_PLAN } from "@/personal/lib/vu-plan";

describe("VU rhythm + QuickFind guards", () => {
  it("normalizeVuTerm coerces aliases object before Object.entries", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/vu-rhythm.ts"), "utf8");
    expect(src).toMatch(/typeof aliasesRaw === "object" && !Array\.isArray\(aliasesRaw\)/);
    expect(normalizeVuTerm("GDDB")).toMatch(/GDB/i);
    expect(normalizeVuTerm("  hello  ")).toBe("hello");
  });

  it("QuickFind coerces buildFinderDrivers result", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/QuickFind.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Array\.isArray\(list\) \? list : \[\]/);
  });

  it("buildVuSeed / buildTodayPrescription tolerate corrupt recovery/student/progress", () => {
    const corrupt = {
      ...VU_STUDY_PLAN,
      student: null,
      recovery: null,
      progressTimeline: "bad",
      enrolledCourses: null,
      todos: null,
    } as never;
    const seed = buildVuSeed(corrupt);
    expect(seed.courses).toEqual([]);
    expect(seed.assessments).toEqual([]);
    expect(seed.settingsPatch.dailyTargetMinutes).toBeGreaterThanOrEqual(120);
    expect(seed.vaultAppendix).toContain("corrupt/missing");

    const rx = buildTodayPrescription(corrupt, "2026-11-17", { handoutFirst: true });
    expect(rx.blocks).toEqual([]);
    expect(rx.dailyTotal).toBeGreaterThanOrEqual(0);
    expect(rx.math).toContain("m/day");
  });
});
