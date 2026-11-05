import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { FORBIDDEN_COMPANY_KEYS, PERSONAL_STORAGE_KEY, defaultCourses } from "@/personal/lib/defaults";
import { PERSONAL_AUTH_KEYS } from "@/personal/lib/auth";
import { STUDY_MODE_MINUTES } from "@/personal/lib/types";

describe("HR Personal isolation", () => {
  it("serves the personal workspace at /personal", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/personal").at(-1)?.routeId).toBe("/personal");
  });

  it("uses personal-only storage keys and never company keys", () => {
    expect(PERSONAL_STORAGE_KEY).toBe("hr-personal-v1");
    expect(PERSONAL_AUTH_KEYS.every((k) => k.startsWith("hr-personal-"))).toBe(true);
    for (const k of FORBIDDEN_COMPANY_KEYS) {
      expect(k).not.toEqual(PERSONAL_STORAGE_KEY);
      expect(PERSONAL_AUTH_KEYS.includes(k as (typeof PERSONAL_AUTH_KEYS)[number])).toBe(false);
    }
  });

  it("seeds VU courses without invented lecture progress", () => {
    const courses = defaultCourses();
    expect(courses.map((c) => c.code)).toEqual([
      "CS101",
      "ENG101",
      "ISL202",
      "MTH202",
      "STA301",
      "TBD",
    ]);
    for (const c of courses) {
      expect(c.lecturesTotal).toBeNull();
      expect(c.lecturesDone).toBeNull();
    }
    expect(courses.filter((c) => c.isTbd)).toHaveLength(1);
  });

  it("defines smart timetable budgets", () => {
    expect(STUDY_MODE_MINUTES).toEqual({ normal: 120, busy: 45, rescue: 20 });
  });
});
