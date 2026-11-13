import type { Assessment, AssessmentKind, DeadlineSource } from "./types";

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

export function normalizeAssessment(raw: Partial<Assessment> & Pick<Assessment, "id" | "title">): Assessment {
  const submitted = Boolean(raw.submitted ?? raw.done);
  const prepDone = Boolean(raw.prepDone);
  return {
    id: raw.id,
    courseId: raw.courseId ?? "general",
    kind: (raw.kind as AssessmentKind) ?? "other",
    title: raw.title,
    dueDate: raw.dueDate ?? "",
    notes: raw.notes ?? "",
    prepDone,
    submitted,
    done: submitted,
    verifyOnVulms: raw.verifyOnVulms ?? true,
    deadlineSource: raw.deadlineSource ?? (raw.dueDate ? "user_entered" : "unset"),
  };
}

/** Prep completion must not flip submitted. */
export function assertPrepDoesNotSubmit(before: Assessment, after: Assessment): boolean {
  if (before.prepDone === after.prepDone) return true;
  // Only prep changed → submitted must be unchanged
  return before.submitted === after.submitted && before.done === after.done;
}
