/**
 * Smart Revision suggestions — derived only from owner notes, assessments,
 * and courses. Never invents exam content or VU lesson text.
 */

import type { Assessment, Course, Note } from "./types";

export const REVISION_TAG_PRESETS = ["revision", "practice", "mistake", "formula", "handout"] as const;

export type RevisionSuggestion = {
  id: string;
  courseId: string;
  courseCode: string;
  reason: string;
  urgency: "high" | "medium" | "low";
};

/** Suggest revision targets from open graded windows + thin note coverage. */
export function suggestRevisionTargets(
  courses: Course[],
  assessments: Assessment[],
  notes: Note[],
  nowMs = Date.now(),
): RevisionSuggestion[] {
  const out: RevisionSuggestion[] = [];
  const notesByCourse = new Map<string, number>();
  for (const n of notes) {
    const key = n.courseId === "general" ? "general" : n.courseId;
    notesByCourse.set(key, (notesByCourse.get(key) ?? 0) + 1);
  }

  for (const a of assessments) {
    if (a.submitted || a.done) continue;
    if (a.kind !== "assignment" && a.kind !== "quiz" && a.kind !== "gdb" && a.kind !== "midterm" && a.kind !== "final") {
      continue;
    }
    const course = courses.find((c) => c.id === a.courseId);
    const code = course?.code ?? a.courseId;
    let urgency: RevisionSuggestion["urgency"] = "medium";
    if (a.dueDate) {
      const due = Date.parse(`${a.dueDate}T23:59:59`);
      if (!Number.isNaN(due)) {
        const hours = (due - nowMs) / 3600000;
        if (hours <= 48) urgency = "high";
        else if (hours > 14 * 24) urgency = "low";
      }
    }
    const prepHint = a.prepDone
      ? "Prep marked — revise before VULMS submit"
      : "Not prepped yet — handout / notes first";
    out.push({
      id: `asm-${a.id}`,
      courseId: a.courseId,
      courseCode: code,
      reason: `${a.kind.toUpperCase()}: ${a.title} · ${prepHint}`,
      urgency,
    });
  }

  for (const c of courses) {
    if (c.isTbd) continue;
    const n = notesByCourse.get(c.id) ?? 0;
    if (n === 0) {
      out.push({
        id: `notes-${c.id}`,
        courseId: c.id,
        courseCode: c.code,
        reason: "No revision notes yet — capture handout bullets when you study",
        urgency: "low",
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 12);
}

export function filterNotesByTag(notes: Note[], tag: string | "all"): Note[] {
  if (tag === "all") return notes;
  const t = tag.toLowerCase();
  return notes.filter((n) => n.tags.some((x) => x.toLowerCase() === t));
}

export const PRACTICE_CHECKLIST = [
  { id: "handout", label: "Re-read linked Handout lesson(s)" },
  { id: "recall", label: "2–3 minute active recall without notes" },
  { id: "mistake", label: "Review one prior mistake / weak topic" },
  { id: "mcq", label: "Owner past-paper / MCQ block (near exams)" },
  { id: "verify", label: "Verify any graded window status on VULMS" },
] as const;
