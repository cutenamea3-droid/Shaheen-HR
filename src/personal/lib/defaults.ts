import type { Course, DisciplineCheck, PersonalSettings, Assessment } from "./types";

/** VU Pakistan BS IT — Fall 2026 first semester. Progress fields stay null (not invented). */
export function defaultCourses(): Course[] {
  return [
    {
      id: "cs101",
      code: "CS101",
      title: "Introduction to Computing",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
    },
    {
      id: "eng101",
      code: "ENG101",
      title: "English Comprehension",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
    },
    {
      id: "isl202",
      code: "ISL202",
      title: "Islamic Studies",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
    },
    {
      id: "mth202",
      code: "MTH202",
      title: "Discrete Mathematics",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
    },
    {
      id: "sta301",
      code: "STA301",
      title: "Statistics and Probability",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
    },
    {
      id: "tbd",
      code: "TBD",
      title: "Editable elective / TBD",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "Replace code and title when confirmed on VULMS.",
      isTbd: true,
    },
  ];
}

export function defaultSettings(): PersonalSettings {
  return {
    theme: "dark",
    studentLabel: "Private study",
    program: "BS Information Technology — VU Pakistan",
    semester: "Fall 2026 · Semester 1",
    dailyTargetMinutes: 120,
    weekdayMinutes: 120,
    sundayMinutes: 270,
    pomodoroFocus: 25,
    pomodoroBreak: 5,
    midtermRef: "2026-12-07",
    finalsRef: "2027-01-25",
  };
}

/** Merge older localStorage blobs without wiping progress / timetable. */
export function migrateSettings(raw: Partial<PersonalSettings> | undefined): PersonalSettings {
  const base = defaultSettings();
  if (!raw) return base;
  const weekday =
    typeof raw.weekdayMinutes === "number"
      ? raw.weekdayMinutes
      : typeof raw.dailyTargetMinutes === "number"
        ? raw.dailyTargetMinutes
        : base.weekdayMinutes;
  return {
    ...base,
    ...raw,
    weekdayMinutes: weekday,
    sundayMinutes: typeof raw.sundayMinutes === "number" ? raw.sundayMinutes : base.sundayMinutes,
    dailyTargetMinutes: weekday,
  };
}

/** Soft calendar anchors only — verify every date on VULMS before relying on them. */
export function defaultAssessments(): Assessment[] {
  return [
    {
      id: "midterm-ref",
      courseId: "general",
      kind: "midterm",
      title: "Midterm exams (semester ref)",
      dueDate: "2026-12-07",
      notes: "Editable reference only. Confirm exact paper dates on VULMS.",
      done: false,
      verifyOnVulms: true,
    },
    {
      id: "finals-ref",
      courseId: "general",
      kind: "final",
      title: "Final exams (semester ref)",
      dueDate: "2027-01-25",
      notes: "Editable reference only. Confirm exact paper dates on VULMS.",
      done: false,
      verifyOnVulms: true,
    },
  ];
}

export function defaultDiscipline(): DisciplineCheck[] {
  return [
    { id: "open-vulms", label: "Opened VULMS / checked announcements", doneDates: [] },
    { id: "study-block", label: "Completed planned study block", doneDates: [] },
    { id: "notes-capture", label: "Captured revision notes", doneDates: [] },
    { id: "no-fake", label: "Logged only real work (no invented progress)", doneDates: [] },
  ];
}

export const PERSONAL_STORAGE_KEY = "hr-personal-v1";

/** Company keys must never be read/written by Personal. */
export const FORBIDDEN_COMPANY_KEYS = [
  "hr-attendance-v1",
  "shaheen-driver-tracker-v1",
  "shaheen-hr-account-secrets-v1",
  "shaheen-hr-account-session-v1",
] as const;
