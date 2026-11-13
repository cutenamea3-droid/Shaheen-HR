/**
 * Owner-entered Grade Book / CGPA estimator helpers.
 * Never invents scores — empty inputs stay empty; projected 50/D defaults ignored.
 * Letter→point map is the public VU handbook scale used only for what-if math.
 */

import type { Course, CourseGrade, GradeEntry } from "./types";

/** Public VU letter → grade point (handbook scale). Not a student grade. */
export const VU_LETTER_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.67,
  "B+": 3.33,
  B: 3.0,
  "B-": 2.67,
  "C+": 2.33,
  C: 2.0,
  "C-": 1.67,
  "D+": 1.33,
  D: 1.0,
  F: 0,
};

export const VU_LETTER_CHOICES = Object.keys(VU_LETTER_POINTS);

/** Handbook-sourced weight bands for what-if semester/final mix — confirm per course on VULMS. */
export const VU_WEIGHT_BANDS = {
  semesterWorkPercent: 40,
  endSemesterExamPercent: 60,
  qualifyAggregatePercent: 40,
  source:
    "https://handbook.vu.edu.pk/HandBook_Pages/Academic%20Rules%20and%20Regulations.htm",
} as const;

export function normalizeLetter(raw: string): string {
  return raw.trim().toUpperCase();
}

export function pointsForLetter(letter: string): number | null {
  const key = normalizeLetter(letter);
  if (!key) return null;
  return key in VU_LETTER_POINTS ? VU_LETTER_POINTS[key]! : null;
}

export type CgpaEstimate = {
  /** null when no owner letters with points + credits */
  cgpa: number | null;
  creditedHours: number;
  gradedCourses: number;
  missingLetters: number;
  label: "empty" | "estimate";
};

export function estimateCgpa(
  courseGrades: CourseGrade[],
  courses: Course[],
): CgpaEstimate {
  let pointsSum = 0;
  let hoursSum = 0;
  let graded = 0;
  let missing = 0;

  for (const g of courseGrades) {
    const pts = pointsForLetter(g.letter);
    const course = courses.find((c) => c.id === g.courseId);
    const hours =
      typeof g.creditHours === "number" && g.creditHours > 0
        ? g.creditHours
        : typeof course?.creditHours === "number" && course.creditHours > 0
          ? course.creditHours
          : null;
    if (pts == null || hours == null) {
      if (g.letter.trim() || hours == null) missing += 1;
      continue;
    }
    pointsSum += pts * hours;
    hoursSum += hours;
    graded += 1;
  }

  if (hoursSum <= 0 || graded <= 0) {
    return {
      cgpa: null,
      creditedHours: 0,
      gradedCourses: 0,
      missingLetters: missing,
      label: "empty",
    };
  }

  return {
    cgpa: Math.round((pointsSum / hoursSum) * 100) / 100,
    creditedHours: hoursSum,
    gradedCourses: graded,
    missingLetters: missing,
    label: "estimate",
  };
}

export type ComponentPct = {
  id: string;
  label: string;
  pct: number | null;
  provenance: GradeEntry["provenance"];
};

export function componentPercents(entries: GradeEntry[]): ComponentPct[] {
  return entries.map((e) => {
    const pct =
      e.score != null && e.maxScore != null && e.maxScore > 0
        ? Math.round((e.score / e.maxScore) * 1000) / 10
        : null;
    return { id: e.id, label: e.label, pct, provenance: e.provenance };
  });
}

/**
 * What-if weighted blend using handbook 40/60 bands.
 * All inputs must be owner-entered percents (0–100); null → null result.
 */
export function estimateCourseAggregate(opts: {
  semesterWorkPct: number | null;
  finalExamPct: number | null;
}): { aggregate: number | null; label: "empty" | "estimate" } {
  const { semesterWorkPct, finalExamPct } = opts;
  if (semesterWorkPct == null || finalExamPct == null) {
    return { aggregate: null, label: "empty" };
  }
  const sw = Math.min(100, Math.max(0, semesterWorkPct));
  const fe = Math.min(100, Math.max(0, finalExamPct));
  const aggregate =
    Math.round(
      (sw * (VU_WEIGHT_BANDS.semesterWorkPercent / 100) +
        fe * (VU_WEIGHT_BANDS.endSemesterExamPercent / 100)) *
        10,
    ) / 10;
  return { aggregate, label: "estimate" };
}

/** Refuse Grade Book projected calculator defaults (50 / D). */
export function looksLikeProjectedDefault(score: number | null, letter: string): boolean {
  const L = normalizeLetter(letter);
  if (score === 50 && (L === "D" || L === "")) return true;
  return false;
}
