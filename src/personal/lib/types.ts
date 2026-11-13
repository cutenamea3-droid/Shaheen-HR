/** HR Personal domain types — isolated from company Admin/Driver models. */

export type StudyMode = "normal" | "busy" | "rescue";

export type CourseId = string;

export type Course = {
  id: CourseId;
  code: string;
  title: string;
  /** User-owned; never invent. Null = not tracked yet. */
  lecturesTotal: number | null;
  lecturesDone: number | null;
  notes: string;
  /** Editable TBD slot when true */
  isTbd: boolean;
  /** From My Study Scheme when seeded from VU exports */
  requirementType?: "Required" | "Elective" | "unknown";
  instructor?: string;
  creditHours?: number | null;
};

export type BacklogItem = {
  id: string;
  courseId: CourseId;
  label: string;
  estimatedMinutes: number;
  done: boolean;
  createdAt: number;
};

export type AssessmentKind = "assignment" | "quiz" | "gdb" | "midterm" | "final" | "other";

/**
 * Provenance for due dates — never invent VULMS windows.
 * - vulms_todo: copied from To-Do Calendar export (verified window)
 * - user_entered: owner typed it (still verify on VULMS)
 * - estimate: planning heuristic only (not a VULMS date)
 * - unset: no date known from exports
 */
export type DeadlineSource = "vulms_todo" | "user_entered" | "estimate" | "unset";

export type Assessment = {
  id: string;
  courseId: CourseId;
  kind: AssessmentKind;
  title: string;
  dueDate: string; // YYYY-MM-DD or "" when unset
  notes: string;
  /**
   * Prep ≠ submit (hard):
   * - prepDone = studied / drafted offline
   * - submitted = confirmed attempt/upload/post on VULMS
   * - done = alias of submitted (legacy)
   */
  prepDone: boolean;
  submitted: boolean;
  done: boolean;
  /** Soft reminder: dates are editable refs — verify on VULMS */
  verifyOnVulms: boolean;
  deadlineSource: DeadlineSource;
};

export type Note = {
  id: string;
  courseId: CourseId | "general";
  title: string;
  body: string;
  updatedAt: number;
  /** Free-form; Batch 11 uses revision / practice / mistake for Smart Revision filters */
  tags: string[];
};

/** VU timer preset ids + revision/practice — never invents minutes; logs elapsed only */
export type FocusActivityKind =
  | "lecture"
  | "handout"
  | "gdb"
  | "quizPrep"
  | "assignment"
  | "break"
  | "revision"
  | "practice"
  | "other";

export type FocusSession = {
  id: string;
  courseId: CourseId | null;
  startedAt: number;
  endedAt: number;
  minutes: number;
  mode: StudyMode;
  label: string;
  /** Optional VU activity tag for Focus Timer history */
  activityKind?: FocusActivityKind;
  /** Optional lesson / topic label entered by owner */
  lessonLabel?: string;
};

/**
 * Owner-entered Grade Book row — never seeded from projected 50/D defaults.
 * provenance distinguishes recorded (from Grade Book export the owner typed)
 * vs what-if estimator inputs.
 */
export type GradeEntry = {
  id: string;
  courseId: CourseId;
  label: string;
  score: number | null;
  maxScore: number | null;
  provenance: "owner_recorded" | "owner_whatif";
  notes: string;
  updatedAt: number;
};

/** Owner-entered course letter for CGPA estimator — empty letter = unset */
export type CourseGrade = {
  id: string;
  courseId: CourseId;
  letter: string;
  creditHours: number | null;
  provenance: "owner_recorded" | "owner_whatif";
  notes: string;
  updatedAt: number;
};

/** Owner exam-prep checklist — dates still come only from owner date-sheet refs */
export type ExamPrepTask = {
  id: string;
  courseId: CourseId;
  examKind: "midterm" | "final" | "quiz" | "other";
  label: string;
  done: boolean;
  notes: string;
};

/** Owner weekly review journal (Sunday / end-of-week discipline) */
export type WeeklyReview = {
  weekStart: string;
  wins: string;
  blockers: string;
  nextFocus: string;
  updatedAt: number;
};

export type DayPlan = {
  date: string; // YYYY-MM-DD
  mode: StudyMode;
  blocks: { id: string; courseId: CourseId; minutes: number; label: string; done: boolean }[];
};

export type DisciplineCheck = {
  id: string;
  label: string;
  doneDates: string[]; // YYYY-MM-DD
};

export type PersonalSettings = {
  theme: "dark" | "light";
  studentLabel: string;
  program: string;
  semester: string;
  /** @deprecated Prefer weekdayMinutes; kept for older local blobs */
  dailyTargetMinutes: number;
  /** Mon–Sat Normal budget (default 120). Adjustable. */
  weekdayMinutes: number;
  /** Sunday Recovery Mission budget (default 270). Adjustable. */
  sundayMinutes: number;
  pomodoroFocus: number;
  pomodoroBreak: number;
  /** Deep focus / break (VU Deep 50/10 default) — adjustable */
  deepFocus: number;
  deepBreak: number;
  /** Editable semester exam reference dates — verify on VULMS */
  midtermRef: string;
  finalsRef: string;
};

export type PersonalState = {
  authed: boolean;
  courses: Course[];
  backlog: BacklogItem[];
  assessments: Assessment[];
  notes: Note[];
  sessions: FocusSession[];
  dayPlans: Record<string, DayPlan>;
  discipline: DisciplineCheck[];
  settings: PersonalSettings;
  vaultNotes: string;
  /** Owner Grade Book component scores — never invent */
  gradeEntries: GradeEntry[];
  /** Owner course letters for CGPA estimator — never invent */
  courseGrades: CourseGrade[];
  /** Owner exam-prep checklist */
  examPrepTasks: ExamPrepTask[];
  /** Owner weekly review journals keyed by weekStart */
  weeklyReviews: Record<string, WeeklyReview>;
  /** ISO timestamp when VU export fixture was last seeded into local study state */
  vuSeededAt: string | null;
  vuPlanAsOf: string | null;
};
