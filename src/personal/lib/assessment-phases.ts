import type { Assessment, AssessmentKind, Course, DeadlineSource } from "./types";

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

/** Prep completion must not flip submitted. */
export function assertPrepDoesNotSubmit(before: Assessment, after: Assessment): boolean {
  if (before.prepDone === after.prepDone) return true;
  // Only prep changed → submitted must be unchanged
  return before.submitted === after.submitted && before.done === after.done;
}
