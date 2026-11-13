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
    deepFocus: 50,
    deepBreak: 10,
    /** Empty until owner pastes a date sheet — never invent mid/final windows */
    midtermRef: "",
    finalsRef: "",
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
    deepFocus: typeof raw.deepFocus === "number" ? raw.deepFocus : base.deepFocus,
    deepBreak: typeof raw.deepBreak === "number" ? raw.deepBreak : base.deepBreak,
  };
}

/**
 * No invented mid/final deadlines — date sheet was not in the VU exports.
 * Owner may add exam refs manually after confirming on VULMS.
 */
export function defaultAssessments(): Assessment[] {
  return [];
}

export function defaultDiscipline(): DisciplineCheck[] {
  return [
    { id: "open-vulms", label: "Opened VULMS / checked announcements", doneDates: [] },
    { id: "study-block", label: "Completed planned study block", doneDates: [] },
    { id: "notes-capture", label: "Captured revision notes", doneDates: [] },
    { id: "no-fake", label: "Logged only real work (no invented progress)", doneDates: [] },
    { id: "recall-after-block", label: "Did 2-minute recall after a Focus block", doneDates: [] },
    { id: "mistake-review", label: "Weekly: one mistake / weak-topic review pass", doneDates: [] },
    {
      id: "past-paper-block",
      label: "Weekly: past-paper / MCQ practice block (near exams only)",
      doneDates: [],
    },
    { id: "weekly-review", label: "Logged Weekly Review (wins / blockers / next)", doneDates: [] },
  ];
}

/** Merge legacy discipline lists without wiping doneDates. */
export function migrateDiscipline(raw: DisciplineCheck[] | undefined): DisciplineCheck[] {
  const base = defaultDiscipline();
  if (!raw?.length) return base;
  const byId = new Map(raw.map((d) => [d.id, d]));
  return base.map((d) => {
    const prev = byId.get(d.id);
    return prev ? { ...d, doneDates: prev.doneDates ?? [] } : d;
  }).concat(
    raw.filter((d) => !base.some((b) => b.id === d.id)),
  );
}

export const PERSONAL_STORAGE_KEY = "hr-personal-v1";

/** Company keys must never be read/written by Personal. */
export const FORBIDDEN_COMPANY_KEYS = [
  "hr-attendance-v1",
  "shaheen-driver-tracker-v1",
  "shaheen-hr-account-secrets-v1",
  "shaheen-hr-account-session-v1",
] as const;
