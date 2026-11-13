/**
 * Weekly Review aggregations — derived from owner-logged sessions,
 * discipline checks, and prep≠submit assessments. No invented progress.
 */

import type {
  Assessment,
  DisciplineCheck,
  FocusSession,
  WeeklyReview,
} from "./types";

/** Monday YYYY-MM-DD for the week containing `isoDate` (local). */
export function weekStartMonday(isoDate = todayLocal()): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const day = dt.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toIso(dt);
}

export function weekEndSunday(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + 6);
  return toIso(dt);
}

export function weekRangeMs(weekStart: string): { fromMs: number; toMs: number } {
  const [y, m, d] = weekStart.split("-").map(Number);
  const from = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  const to = new Date(y!, m! - 1, d!, 23, 59, 59, 999);
  to.setDate(to.getDate() + 6);
  return { fromMs: from.getTime(), toMs: to.getTime() };
}

export type WeeklyStats = {
  weekStart: string;
  weekEnd: string;
  focusMinutes: number;
  sessionCount: number;
  disciplineDoneThisWeek: number;
  disciplineTotal: number;
  prepDoneCount: number;
  submittedCount: number;
  openGradedCount: number;
};

export function buildWeeklyStats(
  weekStart: string,
  sessions: FocusSession[],
  discipline: DisciplineCheck[],
  assessments: Assessment[],
): WeeklyStats {
  const { fromMs, toMs } = weekRangeMs(weekStart);
  const weekEnd = weekEndSunday(weekStart);
  const datesInWeek = enumerateDates(weekStart, weekEnd);

  const inRange = sessions.filter((s) => s.endedAt >= fromMs && s.startedAt <= toMs);
  const focusMinutes = inRange.reduce((sum, s) => sum + s.minutes, 0);
  const sessionCount = inRange.length;

  let disciplineDoneThisWeek = 0;
  for (const d of discipline) {
    if (d.doneDates.some((x) => datesInWeek.includes(x))) disciplineDoneThisWeek += 1;
  }

  const graded = assessments.filter((a) =>
    a.kind === "assignment" || a.kind === "quiz" || a.kind === "gdb",
  );

  return {
    weekStart,
    weekEnd,
    focusMinutes,
    sessionCount,
    disciplineDoneThisWeek,
    disciplineTotal: discipline.length,
    prepDoneCount: graded.filter((a) => a.prepDone).length,
    submittedCount: graded.filter((a) => a.submitted || a.done).length,
    openGradedCount: graded.filter((a) => !a.submitted && !a.done).length,
  };
}

export function emptyWeeklyReview(weekStart: string): WeeklyReview {
  return {
    weekStart,
    wins: "",
    blockers: "",
    nextFocus: "",
    updatedAt: Date.now(),
  };
}

function todayLocal(): string {
  return toIso(new Date());
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const cursor = new Date(y!, m! - 1, d!);
  const end = to;
  for (let i = 0; i < 8; i++) {
    const key = toIso(cursor);
    out.push(key);
    if (key === end) break;
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
