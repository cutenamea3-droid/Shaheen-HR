import type {
  Assessment,
  AssessmentKind,
  BacklogItem,
  Course,
  CourseGrade,
  DeadlineSource,
  ExamPrepTask,
  FocusSession,
  GradeEntry,
  Note,
  StudyMode,
} from "./types";

/** Graded LMS activity nouns — GDB is first-class (not “other”). */
export const GRADED_KINDS: AssessmentKind[] = ["assignment", "quiz", "gdb"];

export function isGradedKind(kind: AssessmentKind): boolean {
  return GRADED_KINDS.includes(kind);
}

export function deadlineBadge(source: DeadlineSource | undefined): {
  label: string;
  tone: "verified" | "estimated" | "user" | "unset";
} {
  switch (source) {
    case "vulms_todo":
      return { label: "Verified · To-Do Calendar", tone: "verified" };
    case "estimate":
      return { label: "Estimated · not VULMS-confirmed", tone: "estimated" };
    case "user_entered":
      return { label: "User-entered · verify on VULMS", tone: "user" };
    default:
      return { label: "Unset · no date in export", tone: "unset" };
  }
}

/**
 * Prep ≠ submit: prepDone never implies submitted.
 * `done` stays aliased to submitted for older UI/tests.
 */
export function withPrepDone(a: Assessment, prepDone: boolean): Assessment {
  return { ...a, prepDone, done: a.submitted };
}

export function withSubmitted(a: Assessment, submitted: boolean): Assessment {
  return {
    ...a,
    submitted,
    done: submitted,
    // Submitting without prep is allowed (user may have prepped offline) —
    // but prep is never auto-flipped on submit either when clearing.
    prepDone: submitted ? a.prepDone : a.prepDone,
  };
}

const asText = (v: unknown, fallback = "") =>
  v == null ? fallback : typeof v === "string" ? v : String(v);

const KIND_SET = new Set<string>([
  "assignment",
  "quiz",
  "gdb",
  "midterm",
  "final",
  "other",
]);

export function normalizeAssessment(raw: Partial<Assessment> & Pick<Assessment, "id" | "title">): Assessment {
  const submitted = Boolean(raw.submitted ?? raw.done);
  const prepDone = Boolean(raw.prepDone);
  const kindRaw = asText(raw.kind, "other").trim().toLowerCase();
  const kind = (KIND_SET.has(kindRaw) ? kindRaw : "other") as AssessmentKind;
  const dueDate = asText(raw.dueDate);
  return {
    id: asText(raw.id),
    courseId: asText(raw.courseId, "general") || "general",
    kind,
    title: asText(raw.title),
    dueDate,
    notes: asText(raw.notes),
    prepDone,
    submitted,
    done: submitted,
    verifyOnVulms: raw.verifyOnVulms ?? true,
    deadlineSource: raw.deadlineSource ?? (dueDate ? "user_entered" : "unset"),
  };
}

/** Coerce corrupt cloud/local course scalars before UI `.toUpperCase` / `.trim`. */
export function normalizeCourse(raw: Partial<Course> & Pick<Course, "id">): Course {
  const req = asText(raw.requirementType).trim();
  const requirementType =
    req === "Required" || req === "Elective" || req === "unknown"
      ? req
      : raw.requirementType == null
        ? undefined
        : "unknown";
  const credit =
    raw.creditHours == null
      ? null
      : typeof raw.creditHours === "number" && Number.isFinite(raw.creditHours)
        ? raw.creditHours
        : Number(raw.creditHours);
  return {
    id: asText(raw.id) || "course",
    code: asText(raw.code),
    title: asText(raw.title),
    lecturesTotal:
      raw.lecturesTotal == null
        ? null
        : typeof raw.lecturesTotal === "number" && Number.isFinite(raw.lecturesTotal)
          ? raw.lecturesTotal
          : Number.isFinite(Number(raw.lecturesTotal))
            ? Number(raw.lecturesTotal)
            : null,
    lecturesDone:
      raw.lecturesDone == null
        ? null
        : typeof raw.lecturesDone === "number" && Number.isFinite(raw.lecturesDone)
          ? raw.lecturesDone
          : Number.isFinite(Number(raw.lecturesDone))
            ? Number(raw.lecturesDone)
            : null,
    notes: asText(raw.notes),
    isTbd: Boolean(raw.isTbd),
    ...(requirementType ? { requirementType } : {}),
    ...(raw.instructor != null ? { instructor: asText(raw.instructor) } : {}),
    ...(raw.creditHours !== undefined
      ? { creditHours: Number.isFinite(credit as number) ? (credit as number) : null }
      : {}),
  };
}

/** Coerce backlog scalars before Today/Backlog `.includes` / display. */
export function normalizeBacklogItem(
  raw: Partial<BacklogItem> & Pick<BacklogItem, "id">,
): BacklogItem {
  const mins = Number(raw.estimatedMinutes);
  return {
    id: asText(raw.id) || "backlog",
    courseId: asText(raw.courseId, "general") || "general",
    label: asText(raw.label),
    estimatedMinutes: Number.isFinite(mins) && mins > 0 ? mins : 30,
    done: Boolean(raw.done),
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Number.isFinite(Number(raw.createdAt))
          ? Number(raw.createdAt)
          : Date.now(),
  };
}

/** Coerce note scalars before Notes editor controlled inputs / `.trim`. */
export function normalizeNote(raw: Partial<Note> & Pick<Note, "id">): Note {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => (t == null ? "" : typeof t === "string" ? t : String(t))).filter(Boolean)
    : [];
  return {
    id: asText(raw.id) || "note",
    courseId: (asText(raw.courseId, "general") || "general") as Note["courseId"],
    title: asText(raw.title),
    body: asText(raw.body),
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Number.isFinite(Number(raw.updatedAt))
          ? Number(raw.updatedAt)
          : Date.now(),
    tags,
  };
}

const EXAM_KIND_SET = new Set<string>(["midterm", "final", "quiz", "other"]);

/** Coerce exam-prep checklist scalars before Assessments UI render. */
export function normalizeExamPrepTask(
  raw: Partial<ExamPrepTask> & Pick<ExamPrepTask, "id">,
): ExamPrepTask {
  const kindRaw = asText(raw.examKind, "other").trim().toLowerCase();
  const examKind = (
    EXAM_KIND_SET.has(kindRaw) ? kindRaw : "other"
  ) as ExamPrepTask["examKind"];
  return {
    id: asText(raw.id) || "exam-prep",
    courseId: asText(raw.courseId, "general") || "general",
    examKind,
    label: asText(raw.label),
    done: Boolean(raw.done),
    notes: asText(raw.notes),
  };
}

const MODE_SET = new Set<string>(["normal", "busy", "rescue"]);

function asMs(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Coerce focus session scalars before Analytics/Focus minute sums. */
export function normalizeFocusSession(
  raw: Partial<FocusSession> & Pick<FocusSession, "id">,
): FocusSession {
  const modeRaw = asText(raw.mode, "normal").trim().toLowerCase();
  const mode = (MODE_SET.has(modeRaw) ? modeRaw : "normal") as StudyMode;
  const mins = asNumOrNull(raw.minutes);
  return {
    id: asText(raw.id) || "session",
    courseId: raw.courseId == null ? null : asText(raw.courseId) || null,
    startedAt: asMs(raw.startedAt, Date.now()),
    endedAt: asMs(raw.endedAt, Date.now()),
    minutes: mins != null && mins >= 0 ? mins : 0,
    mode,
    label: asText(raw.label),
    ...(raw.activityKind != null ? { activityKind: raw.activityKind } : {}),
    ...(raw.lessonLabel != null ? { lessonLabel: asText(raw.lessonLabel) } : {}),
  };
}

/** Coerce Grade Book rows before Analytics display / percent math. */
export function normalizeGradeEntry(
  raw: Partial<GradeEntry> & Pick<GradeEntry, "id">,
): GradeEntry {
  const prov =
    raw.provenance === "owner_whatif" || raw.provenance === "owner_recorded"
      ? raw.provenance
      : "owner_recorded";
  return {
    id: asText(raw.id) || "grade",
    courseId: asText(raw.courseId, "general") || "general",
    label: asText(raw.label),
    score: asNumOrNull(raw.score),
    maxScore: asNumOrNull(raw.maxScore),
    provenance: prov,
    notes: asText(raw.notes),
    updatedAt: asMs(raw.updatedAt, Date.now()),
  };
}

/** Coerce CGPA letter rows before estimateCgpa. */
export function normalizeCourseGrade(
  raw: Partial<CourseGrade> & Pick<CourseGrade, "id">,
): CourseGrade {
  const prov =
    raw.provenance === "owner_whatif" || raw.provenance === "owner_recorded"
      ? raw.provenance
      : "owner_recorded";
  return {
    id: asText(raw.id) || "course-grade",
    courseId: asText(raw.courseId, "general") || "general",
    letter: asText(raw.letter),
    creditHours: asNumOrNull(raw.creditHours),
    provenance: prov,
    notes: asText(raw.notes),
    updatedAt: asMs(raw.updatedAt, Date.now()),
  };
}

/** Prep completion must not flip submitted. */
export function assertPrepDoesNotSubmit(before: Assessment, after: Assessment): boolean {
  if (before.prepDone === after.prepDone) return true;
  // Only prep changed → submitted must be unchanged
  return before.submitted === after.submitted && before.done === after.done;
}
