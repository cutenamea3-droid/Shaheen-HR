import { beforeEach, describe, expect, it } from "vitest";
import { defaultCourses, defaultSettings } from "@/personal/lib/defaults";
import { usePersonal } from "@/personal/lib/store";
import { buildVuSeed } from "@/personal/lib/vu-import";
import {
  VU_STUDY_PLAN,
  buildTodayPrescription,
  formatMinutes,
  overdueTodos,
  pendencyTodos,
} from "@/personal/lib/vu-plan";
import { VU_LESSON_RHYTHM } from "@/personal/lib/vu-rhythm";

describe("HR Personal VU recovery fixture", () => {
  it("binds student identity from e-card / grade book exports", () => {
    expect(VU_STUDY_PLAN.student.studentId).toBe("BC260433937");
    expect(VU_STUDY_PLAN.student.name.toLowerCase()).toContain("yousaf");
    expect(VU_STUDY_PLAN.student.program).toMatch(/Information Technology/i);
    expect(VU_STUDY_PLAN.gradeBook.recordedMarks).toBeNull();
  });

  it("never treats projected CGPA calculator defaults as grades", () => {
    expect(VU_STUDY_PLAN.gradeBook.notes.join(" ")).toMatch(/NOT earned/i);
    expect(VU_STUDY_PLAN.gradeBook.semesterRecords).toEqual([]);
  });

  it("includes enrolled Fall 2026 courses with required/elective from scheme", () => {
    const codes = VU_STUDY_PLAN.enrolledCourses.map((c) => c.code);
    expect(codes).toEqual(
      expect.arrayContaining(["CS101", "ENG101", "ISL202", "MTH202", "PHY101", "STA301", "VU001"]),
    );
    const isl = VU_STUDY_PLAN.enrolledCourses.find((c) => c.code === "ISL202");
    const cs = VU_STUDY_PLAN.enrolledCourses.find((c) => c.code === "CS101");
    expect(isl?.type).toBe("Elective");
    expect(cs?.type).toBe("Required");
  });

  it("uses Progress Timeline CS101 catch-up without inventing other-course deficits", () => {
    const catchUp = VU_STUDY_PLAN.recovery.cs101ProgressCatchUp;
    expect(catchUp.absentWeeksVisible).toBe(3);
    expect(catchUp.estimatedCatchUpMinutes).toBe(450);
    expect(VU_STUDY_PLAN.progressTimeline.limitation).toMatch(/active tab/i);
    const eng = VU_STUDY_PLAN.progressTimeline.courses.ENG101;
    expect(eng.dataLoaded).toBe(false);
  });

  it("builds today prescription math from exports only", () => {
    const rx = buildTodayPrescription(VU_STUDY_PLAN, "2026-11-10");
    expect(rx.dailyTotal).toBe(VU_STUDY_PLAN.recovery.recommendedDailyMinutes.total);
    expect(rx.blocks.some((b) => b.courseCode === "ISL202")).toBe(true);
    expect(rx.blocks.some((b) => b.kind === "cs101_catchup")).toBe(true);
    expect(rx.blocks[0]?.priority).toBe(0); // graded To-Do first
    expect(formatMinutes(rx.dailyTotal)).toMatch(/h/);
    expect(pendencyTodos(VU_STUDY_PLAN, "2026-11-10").length).toBeGreaterThan(0);
    expect(overdueTodos(VU_STUDY_PLAN, "2026-11-10").length).toBe(3);
  });

  it("supports handout-first catch-up without inventing other-course Progress", () => {
    const full = buildTodayPrescription(VU_STUDY_PLAN, "2026-11-10", { handoutFirst: false });
    const hf = buildTodayPrescription(VU_STUDY_PLAN, "2026-11-10", { handoutFirst: true });
    expect(hf.dailyTotal).toBeLessThan(full.dailyTotal);
    expect(hf.blocks.some((b) => b.kind === "handout" || /Handout/i.test(b.label))).toBe(true);
  });

  it("exposes public VU lesson rhythm separately from remaining-work data", () => {
    expect(VU_LESSON_RHYTHM.map((s) => s.id)).toEqual([
      "handout",
      "lecture",
      "mdb",
      "assignment",
      "gdb",
      "quiz",
      "revise",
    ]);
  });

  it("seeds Personal store from VU fixture without inventing lecture totals", () => {
    const seed = buildVuSeed(VU_STUDY_PLAN);
    expect(seed.courses.every((c) => c.lecturesTotal === null && c.lecturesDone === null)).toBe(
      true,
    );
    expect(seed.assessments.some((a) => a.title.includes("Assignment"))).toBe(true);
    expect(seed.settingsPatch.studentLabel).toMatch(/BC260433937/);
  });
});

describe("HR Personal VU import action", () => {
  beforeEach(() => {
    usePersonal.setState({
      courses: defaultCourses(),
      backlog: [],
      assessments: [],
      sessions: [],
      dayPlans: {},
      settings: defaultSettings(),
      vaultNotes: "",
      vuSeededAt: null,
      vuPlanAsOf: null,
      authed: false,
    });
  });

  it("importVuStudyPlan writes courses, assessments, backlog, and seed stamps", () => {
    usePersonal.getState().importVuStudyPlan();
    const s = usePersonal.getState();
    expect(s.vuPlanAsOf).toBe(VU_STUDY_PLAN.asOf);
    expect(s.vuSeededAt).toBeTruthy();
    expect(s.courses.map((c) => c.code)).toEqual(
      expect.arrayContaining(["CS101", "PHY101", "VU001"]),
    );
    expect(s.backlog.length).toBeGreaterThan(0);
    expect(s.assessments.some((a) => a.verifyOnVulms)).toBe(true);
  });
});
