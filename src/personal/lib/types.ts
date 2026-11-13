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
  tags: string[];
};

export type FocusSession = {
  id: string;
  courseId: CourseId | null;
  startedAt: number;
  endedAt: number;
  minutes: number;
  mode: StudyMode;
  label: string;
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
  /** ISO timestamp when VU export fixture was last seeded into local study state */
  vuSeededAt: string | null;
  vuPlanAsOf: string | null;
};
