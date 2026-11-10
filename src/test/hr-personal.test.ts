import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import {
  FORBIDDEN_COMPANY_KEYS,
  PERSONAL_STORAGE_KEY,
  defaultCourses,
  defaultSettings,
  migrateSettings,
} from "@/personal/lib/defaults";
import { PERSONAL_AUTH_KEYS } from "@/personal/lib/auth";
import {
  BUSY_MINUTES,
  RESCUE_MINUTES,
  isSundayIso,
  modeBudgetMinutes,
  modeLabel,
  STUDY_MODE_MINUTES,
} from "@/personal/lib/schedule";
import { shouldShowPersonalSwitcherLink } from "@/personal/lib/access";

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
      "PHY101",
      "STA301",
      "VU001",
    ]);
    for (const c of courses) {
      expect(c.lecturesTotal).toBeNull();
      expect(c.lecturesDone).toBeNull();
    }
    expect(courses.filter((c) => c.isTbd)).toHaveLength(0);
  });

  it("defines weekday / Sunday Recovery / Busy / Rescue budgets", () => {
    const s = defaultSettings();
    expect(s.weekdayMinutes).toBe(266);
    expect(s.sundayMinutes).toBe(330);
    expect(BUSY_MINUTES).toBe(45);
    expect(RESCUE_MINUTES).toBe(20);
    expect(STUDY_MODE_MINUTES).toEqual({ normal: 120, busy: 45, rescue: 20 });

    expect(isSundayIso("2026-11-08")).toBe(true);
    expect(modeBudgetMinutes("normal", "2026-11-08", s)).toBe(330);
    expect(modeLabel("normal", "2026-11-08")).toBe("Sunday Recovery Mission");
    expect(isSundayIso("2026-11-09")).toBe(false);
    expect(modeBudgetMinutes("normal", "2026-11-09", s)).toBe(266);
    expect(modeBudgetMinutes("busy", "2026-11-08", s)).toBe(45);
    expect(modeBudgetMinutes("rescue", "2026-11-09", s)).toBe(20);
  });

  it("migrates older settings without inventing progress fields", () => {
    const migrated = migrateSettings({ dailyTargetMinutes: 90, theme: "light" });
    expect(migrated.weekdayMinutes).toBe(90);
    expect(migrated.sundayMinutes).toBe(330);
    expect(migrated.theme).toBe("light");
  });

  it("never shows Personal switcher to ordinary company users", () => {
    expect(shouldShowPersonalSwitcherLink(false)).toBe(false);
    expect(shouldShowPersonalSwitcherLink(true)).toBe(true);
  });
});
