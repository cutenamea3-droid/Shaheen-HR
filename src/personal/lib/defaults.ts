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
      requirementType: "Required",
      instructor: "Dr. M. Tanvir Afzal",
      creditHours: 3,
    },
    {
      id: "eng101",
      code: "ENG101",
      title: "English Comprehension",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
      requirementType: "Required",
      instructor: "Dr. Surriya Shaffi Mir",
      creditHours: 3,
    },
    {
      id: "isl202",
      code: "ISL202",
      title: "Islamic Studies",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "Elective group ISL202/ETH202 — enrolled ISL202",
      isTbd: false,
      requirementType: "Elective",
      instructor: "Abdul Quddoos Durrani",
      creditHours: 2,
    },
    {
      id: "mth202",
      code: "MTH202",
      title: "Discrete Mathematics",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
      requirementType: "Required",
      instructor: "Dr. Shoaib-ud- Din",
      creditHours: 3,
    },
    {
      id: "phy101",
      code: "PHY101",
      title: "Physics",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "Elective group PHY101/PHY301 — enrolled PHY101",
      isTbd: false,
      requirementType: "Elective",
      instructor: "Dr. Pervez Hoodbhoy",
      creditHours: 3,
    },
    {
      id: "sta301",
      code: "STA301",
      title: "Statistics and Probability",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "",
      isTbd: false,
      requirementType: "Required",
      instructor: "Dr. Saleha Naghmi Habibullah",
      creditHours: 3,
    },
    {
      id: "vu001",
      code: "VU001",
      title: "Introduction to e-Learning",
      lecturesTotal: null,
      lecturesDone: null,
      notes: "University requirement",
      isTbd: false,
      requirementType: "Required",
      instructor: "Virtual University of Pakistan",
      creditHours: 1,
    },
  ];
}

export function defaultSettings(): PersonalSettings {
  return {
    theme: "dark",
    studentLabel: "Yousaf Shahzad · BC260433937",
    program: "BS Information Technology — VU",
    semester: "Fall 2026 · Sem 1 · Fall 2026(2604)",
    dailyTargetMinutes: 266,
    weekdayMinutes: 266,
    sundayMinutes: 330,
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
