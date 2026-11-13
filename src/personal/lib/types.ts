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

export type AssessmentKind = "assignment" | "quiz" | "midterm" | "final" | "other";

export type Assessment = {
  id: string;
  courseId: CourseId;
  kind: AssessmentKind;
  title: string;
  dueDate: string; // YYYY-MM-DD
  notes: string;
  done: boolean;
  /** Soft reminder: dates are editable refs — verify on VULMS */
  verifyOnVulms: boolean;
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
