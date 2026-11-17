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

/** Coerce cloud/local date keys before `.split("-")` — corrupt non-strings crash otherwise. */
function asIsoDate(raw: unknown, fallback = todayLocal()): string {
  const s = raw == null ? "" : typeof raw === "string" ? raw : String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fallback;
}

/** Monday YYYY-MM-DD for the week containing `isoDate` (local). */
export function weekStartMonday(isoDate: unknown = todayLocal()): string {
  const [y, m, d] = asIsoDate(isoDate).split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const day = dt.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toIso(dt);
}

export function weekEndSunday(weekStart: unknown): string {
  const [y, m, d] = asIsoDate(weekStart).split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + 6);
  return toIso(dt);
}

export function weekRangeMs(weekStart: unknown): { fromMs: number; toMs: number } {
  const [y, m, d] = asIsoDate(weekStart).split("-").map(Number);
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
  weekStart: unknown,
  sessions: FocusSession[],
  discipline: DisciplineCheck[],
  assessments: Assessment[],
): WeeklyStats {
  const start = asIsoDate(weekStart);
  const { fromMs, toMs } = weekRangeMs(start);
  const weekEnd = weekEndSunday(start);
  const datesInWeek = enumerateDates(start, weekEnd);

  const sess = Array.isArray(sessions) ? sessions : [];
  const disc = Array.isArray(discipline) ? discipline : [];
  const asses = Array.isArray(assessments) ? assessments : [];
  const inRange = sess.filter((s) => s.endedAt >= fromMs && s.startedAt <= toMs);
  const focusMinutes = inRange.reduce((sum, s) => sum + s.minutes, 0);
  const sessionCount = inRange.length;

  let disciplineDoneThisWeek = 0;
  for (const d of disc) {
    const doneDates = Array.isArray(d.doneDates) ? d.doneDates : [];
    if (
      doneDates.some((x) => {
        const day = x == null ? "" : typeof x === "string" ? x : String(x);
        return day ? datesInWeek.includes(day) : false;
      })
    )
      disciplineDoneThisWeek += 1;
  }

  const graded = asses.filter((a) =>
    a.kind === "assignment" || a.kind === "quiz" || a.kind === "gdb",
  );

  return {
    weekStart: start,
    weekEnd,
    focusMinutes,
    sessionCount,
    disciplineDoneThisWeek,
    disciplineTotal: disc.length,
    prepDoneCount: graded.filter((a) => a.prepDone).length,
    submittedCount: graded.filter((a) => a.submitted || a.done).length,
    openGradedCount: graded.filter((a) => !a.submitted && !a.done).length,
  };
}

export function emptyWeeklyReview(weekStart: unknown): WeeklyReview {
  return {
    weekStart: asIsoDate(weekStart),
    wins: "",
    blockers: "",
    nextFocus: "",
    updatedAt: Date.now(),
  };
}

/** Coerce weekly review journal scalars from corrupt cloud/local persist. */
export function normalizeWeeklyReview(raw: unknown, weekKey?: unknown): WeeklyReview {
  const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyWeeklyReview(weekKey);
  }
  const r = raw as Partial<WeeklyReview>;
  const updated =
    typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt)
      ? r.updatedAt
      : Number.isFinite(Number(r.updatedAt))
        ? Number(r.updatedAt)
        : Date.now();
  return {
    weekStart: asIsoDate(r.weekStart ?? weekKey),
    wins: asText(r.wins),
    blockers: asText(r.blockers),
    nextFocus: asText(r.nextFocus),
    updatedAt: updated,
  };
}

/** Normalize a weeklyReviews map — keys and values coerced. */
export function normalizeWeeklyReviews(
  raw: unknown,
  fallback: Record<string, WeeklyReview> = {},
): Record<string, WeeklyReview> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : fallback;
  const out: Record<string, WeeklyReview> = {};
  for (const [k, v] of Object.entries(src)) {
    const key = k == null ? "" : typeof k === "string" ? k : String(k);
    if (!key) continue;
    out[key] = normalizeWeeklyReview(v, key);
  }
  return out;
}

function todayLocal(): string {
  return toIso(new Date());
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = asIsoDate(from).split("-").map(Number);
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
