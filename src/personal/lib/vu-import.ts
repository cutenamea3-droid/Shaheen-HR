import type { Assessment, AssessmentKind, BacklogItem, Course, PersonalSettings } from "./types";
import {
  VU_STUDY_PLAN,
  courseIdFromCode,
  type VuStudyPlan,
  type VuTodo,
} from "./vu-plan";

function kindFromTodo(t: VuTodo): AssessmentKind {
  if (t.kind === "assignment") return "assignment";
  if (t.kind === "quiz") return "quiz";
  if (t.kind === "gdb") return "gdb";
  return "other";
}

function assessmentId(t: VuTodo): string {
  const raw = `${t.courseCode || "gen"}-${t.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `vu-${raw}`.slice(0, 72);
}

/** Map VU fixture into Personal store slices — progress fields stay honest. */
export function buildVuSeed(plan: VuStudyPlan = VU_STUDY_PLAN): {
  courses: Course[];
  assessments: Assessment[];
  backlog: BacklogItem[];
  settingsPatch: Partial<PersonalSettings>;
  vaultAppendix: string;
} {
  const student = plan.student;
  const courses: Course[] = plan.enrolledCourses.map((c) => {
    const code = c.code;
    const prog = plan.progressTimeline.courses[code as keyof typeof plan.progressTimeline.courses] as
      | {
          quizSummary?: { totalQuizzes?: number | null; submitted?: number | null } | null;
          learningActivityByWeek?: { week: string; topicCompleted: number }[] | null;
          attendance?: { presentPct?: number | null; absentPct?: number | null } | null;
          notes?: string[];
        }
      | undefined;
    const notesParts: string[] = [];
    if (c.type) notesParts.push(`Scheme: ${c.type}`);
    if (c.instructor) notesParts.push(`Instructor: ${c.instructor}`);
    if (prog?.attendance?.presentPct != null) {
      notesParts.push(
        `Progress attendance Present ${prog.attendance.presentPct}% / Absent ${prog.attendance.absentPct ?? "?"}%;`,
      );
    }
    if (prog?.quizSummary?.totalQuizzes != null) {
      notesParts.push(
        `Progress quizzes submitted ${prog.quizSummary.submitted ?? 0}/${prog.quizSummary.totalQuizzes}`,
      );
    }
    if (prog?.notes?.length) notesParts.push(...prog.notes);
    return {
      id: courseIdFromCode(code),
      code,
      title: c.title,
      lecturesTotal: null,
      lecturesDone: null,
      notes: notesParts.join(" · "),
      isTbd: false,
      requirementType: (c.type as "Required" | "Elective" | "unknown") || "unknown",
      instructor: c.instructor ?? undefined,
      creditHours: c.creditHours ?? null,
    };
  });

  const assessments: Assessment[] = (plan.todos as VuTodo[])
    .filter((t) => t.kind !== "fee" && t.due)
    .map((t) => ({
      id: assessmentId(t),
      courseId: t.courseCode ? courseIdFromCode(t.courseCode) : "general",
      kind: kindFromTodo(t),
      title: t.title,
      dueDate: t.due as string,
      notes: `VULMS window ${t.start || "?"} → ${t.due}. Completion unknown in export — prep ≠ submit; confirm attempt/upload on VULMS.`,
      prepDone: false,
      submitted: false,
      done: false,
      verifyOnVulms: true,
      /** Due window copied from To-Do Calendar export — verified provenance */
      deadlineSource: "vulms_todo" as const,
    }));

  // Mid/final date sheet was NOT in exports — do not invent anchors here.
  // Owner can add exam refs later via Assessments after confirming on VULMS.

  const now = Date.now();
  const backlog: BacklogItem[] = plan.recovery.priorityTodos.map((t, i) => ({
    id: `vu-backlog-${i}-${assessmentId(t as VuTodo).slice(3, 24)}`,
    courseId: t.courseCode ? courseIdFromCode(t.courseCode) : "general",
    label:
      (t as VuTodo).statusAsOf === "window_ended"
        ? `Verify · ${t.title}`
        : `Clear · ${t.title}`,
    estimatedMinutes: t.kind === "assignment" ? 90 : 45,
    done: false,
    createdAt: now + i,
  }));

  // CS101 Progress catch-up backlog
  const catchUp = plan.recovery.cs101ProgressCatchUp;
  if (catchUp?.estimatedCatchUpMinutes) {
    backlog.unshift({
      id: "vu-backlog-cs101-progress",
      courseId: "cs101",
      label: `CS101 Progress catch-up (${catchUp.absentWeeksVisible} absent weeks)`,
      estimatedMinutes: Math.min(90, Math.round(catchUp.estimatedCatchUpMinutes / 7)),
      done: false,
      createdAt: now - 1,
    });
  }

  const daily = plan.recovery.recommendedDailyMinutes.total;
  const settingsPatch: Partial<PersonalSettings> = {
    studentLabel: `${student.name} · ${student.studentId}`,
    program: `BS ${student.program} — VU`,
    semester: `${student.semesterLabel} · Sem 1 · ${student.version}`,
    weekdayMinutes: Math.min(Math.max(daily, 120), 300),
    dailyTargetMinutes: Math.min(Math.max(daily, 120), 300),
    sundayMinutes: Math.min(Math.max(Math.round(daily * 1.25), 180), 360),
    // Keep exam refs empty unless owner already set them — never inject invented dates
    midtermRef: "",
    finalsRef: "",
  };

  const vaultAppendix = [
    "— VU export seed —",
    `As-of ${plan.asOf} · ${student.name} (${student.studentId})`,
    `Daily target math: ${plan.recovery.recommendedDailyMinutes.math}`,
    `Grade Book recorded marks: none`,
    `Progress full payload: CS101 only in this export`,
    "Deadlines marked Verified are from To-Do Calendar export only.",
    "Prep ≠ submit — mark Submitted only after VULMS attempt/upload/post.",
    "No mid/final date sheet in this export — leave exam refs blank until published.",
  ].join("\n");

  return { courses, assessments, backlog, settingsPatch, vaultAppendix };
}
