import { beforeEach, describe, expect, it } from "vitest";
import {
  VU_LETTER_POINTS,
  estimateCgpa,
  estimateCourseAggregate,
  looksLikeProjectedDefault,
  pointsForLetter,
} from "@/personal/lib/gpa";
import {
  PRACTICE_CHECKLIST,
  filterNotesByTag,
  suggestRevisionTargets,
} from "@/personal/lib/revision";
import {
  buildWeeklyStats,
  weekEndSunday,
  weekStartMonday,
} from "@/personal/lib/weekly-review";
import { defaultDiscipline, defaultSettings, migrateDiscipline, migrateSettings } from "@/personal/lib/defaults";
import { usePersonal } from "@/personal/lib/store";
import { vuQuickLinks, VU_TIMER_PRESETS, VU_FOCUS_MODES } from "@/personal/lib/vu-rhythm";
import { defaultCourses } from "@/personal/lib/defaults";

describe("Batch 11A — Focus Timer presets", () => {
  it("exposes VU timer presets and Pomodoro/Deep modes without inventing minutes", () => {
    expect(VU_TIMER_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining(["lecture", "handout", "gdb", "quizPrep", "assignment", "break"]),
    );
    expect(VU_FOCUS_MODES.find((m) => m.name === "pomodoro")).toMatchObject({
      workMinutes: 25,
      breakMinutes: 5,
    });
    expect(VU_FOCUS_MODES.find((m) => m.name === "deep")).toMatchObject({
      workMinutes: 50,
      breakMinutes: 10,
    });
    const s = migrateSettings({});
    expect(s.deepFocus).toBe(50);
    expect(s.deepBreak).toBe(10);
    expect(defaultSettings().pomodoroFocus).toBe(25);
  });

  it("logs Focus sessions with optional activityKind via store", () => {
    usePersonal.setState({ sessions: [] });
    usePersonal.getState().addSession({
      courseId: "cs101",
      startedAt: Date.now() - 600000,
      endedAt: Date.now(),
      minutes: 10,
      mode: "normal",
      label: "Handout",
      activityKind: "handout",
      lessonLabel: "Lec 05",
    });
    const s = usePersonal.getState().sessions[0]!;
    expect(s.activityKind).toBe("handout");
    expect(s.lessonLabel).toBe("Lec 05");
    expect(s.minutes).toBe(10);
  });
});

describe("Batch 11A — Smart Revision & VU Quick Links", () => {
  it("suggests revision from open assessments without inventing content", () => {
    const courses = defaultCourses();
    const suggestions = suggestRevisionTargets(
      courses,
      [
        {
          id: "q1",
          courseId: "cs101",
          kind: "quiz",
          title: "CS101 Quiz (owner)",
          dueDate: "2099-01-01",
          notes: "",
          prepDone: false,
          submitted: false,
          done: false,
          verifyOnVulms: true,
          deadlineSource: "user_entered",
        },
      ],
      [],
    );
    expect(suggestions.some((s) => s.courseCode === "CS101")).toBe(true);
    expect(suggestions.every((s) => !s.reason.includes("invent"))).toBe(true);
    expect(PRACTICE_CHECKLIST.length).toBeGreaterThanOrEqual(4);
    expect(filterNotesByTag([{ id: "1", courseId: "cs101", title: "t", body: "", updatedAt: 1, tags: ["revision"] }], "revision")).toHaveLength(1);
  });

  it("builds official VU Quick Links with search-by-code (no fabricated video IDs)", () => {
    const links = vuQuickLinks("CS101");
    expect(links.some((l) => l.id === "vulms")).toBe(true);
    expect(links.some((l) => l.id === "handbook")).toBe(true);
    const yt = links.find((l) => l.id === "youtube")!;
    expect(yt.href).toContain("youtube.com/results");
    expect(yt.href).toContain("CS101");
    expect(yt.blurb.toLowerCase()).toContain("fabricat");
  });
});

describe("Batch 11A — Grades/GPA estimator honesty", () => {
  it("returns empty CGPA until owner letters exist and refuses projected 50/D as recorded", () => {
    expect(estimateCgpa([], defaultCourses()).label).toBe("empty");
    expect(estimateCgpa([], defaultCourses()).cgpa).toBeNull();
    expect(pointsForLetter("B+")).toBe(VU_LETTER_POINTS["B+"]);
    expect(looksLikeProjectedDefault(50, "D")).toBe(true);
    expect(looksLikeProjectedDefault(80, "B")).toBe(false);

    const est = estimateCgpa(
      [
        {
          id: "1",
          courseId: "cs101",
          letter: "A",
          creditHours: 3,
          provenance: "owner_whatif",
          notes: "",
          updatedAt: 1,
        },
        {
          id: "2",
          courseId: "eng101",
          letter: "B",
          creditHours: 3,
          provenance: "owner_recorded",
          notes: "",
          updatedAt: 1,
        },
      ],
      defaultCourses(),
    );
    expect(est.label).toBe("estimate");
    expect(est.cgpa).toBe(3.5);
    expect(estimateCourseAggregate({ semesterWorkPct: null, finalExamPct: 60 }).label).toBe("empty");
    expect(estimateCourseAggregate({ semesterWorkPct: 50, finalExamPct: 60 }).aggregate).toBe(56);
  });
});

describe("Batch 11A — Exam Prep + Weekly Review & discipline", () => {
  beforeEach(() => {
    usePersonal.setState({
      examPrepTasks: [],
      weeklyReviews: {},
      gradeEntries: [],
      courseGrades: [],
      sessions: [],
      assessments: [],
      discipline: defaultDiscipline(),
    });
  });

  it("stores exam-prep tasks without inventing dates (prep checklist ≠ submit)", () => {
    usePersonal.getState().upsertExamPrepTask({
      id: "ep1",
      courseId: "cs101",
      examKind: "midterm",
      label: "Handout revision pass (owner)",
      done: false,
      notes: "",
    });
    expect(usePersonal.getState().examPrepTasks).toHaveLength(1);
    usePersonal.getState().toggleExamPrepTask("ep1");
    expect(usePersonal.getState().examPrepTasks[0]!.done).toBe(true);
    expect(defaultSettings().midtermRef).toBe("");
    expect(defaultSettings().finalsRef).toBe("");
  });

  it("aggregates weekly review from real sessions + discipline and migrates new checks", () => {
    const week = weekStartMonday("2026-11-13"); // Friday → Monday 2026-11-09
    expect(week).toBe("2026-11-09");
    expect(weekEndSunday(week)).toBe("2026-11-15");

    usePersonal.getState().addSession({
      courseId: "cs101",
      startedAt: Date.parse("2026-11-10T10:00:00"),
      endedAt: Date.parse("2026-11-10T10:25:00"),
      minutes: 25,
      mode: "normal",
      label: "Pomodoro",
      activityKind: "lecture",
    });
    usePersonal.getState().toggleDiscipline("weekly-review", "2026-11-10");
    usePersonal.getState().upsertWeeklyReview({
      weekStart: week,
      wins: "Logged real Focus",
      blockers: "",
      nextFocus: "Handouts",
      updatedAt: Date.now(),
    });

    const stats = buildWeeklyStats(
      week,
      usePersonal.getState().sessions,
      usePersonal.getState().discipline,
      usePersonal.getState().assessments,
    );
    expect(stats.focusMinutes).toBe(25);
    expect(stats.sessionCount).toBe(1);
    expect(stats.disciplineDoneThisWeek).toBeGreaterThanOrEqual(1);
    expect(usePersonal.getState().weeklyReviews[week]?.wins).toBe("Logged real Focus");

    const migrated = migrateDiscipline([
      { id: "open-vulms", label: "Opened VULMS / checked announcements", doneDates: ["2026-11-01"] },
    ]);
    expect(migrated.some((d) => d.id === "weekly-review")).toBe(true);
    expect(migrated.find((d) => d.id === "open-vulms")?.doneDates).toEqual(["2026-11-01"]);
  });
});
