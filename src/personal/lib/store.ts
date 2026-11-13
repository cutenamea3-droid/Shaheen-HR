import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultAssessments,
  defaultCourses,
  defaultDiscipline,
  defaultSettings,
  migrateDiscipline,
  migrateSettings,
  PERSONAL_STORAGE_KEY,
} from "./defaults";
import type {
  Assessment,
  BacklogItem,
  Course,
  CourseGrade,
  DayPlan,
  DisciplineCheck,
  ExamPrepTask,
  FocusSession,
  GradeEntry,
  Note,
  PersonalSettings,
  PersonalState,
  StudyMode,
  WeeklyReview,
} from "./types";
import { normalizeAssessment, withPrepDone, withSubmitted } from "./assessment-phases";
import { modeBudgetMinutes } from "./schedule";
import { buildVuSeed } from "./vu-import";
import { VU_STUDY_PLAN, courseIdFromCode, type VuStudyPlan } from "./vu-plan";

const uid = () => Math.random().toString(36).slice(2, 10);

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Actions = {
  setAuthed: (v: boolean) => void;
  setSettings: (p: Partial<PersonalSettings>) => void;
  upsertCourse: (c: Course) => void;
  updateCourse: (id: string, p: Partial<Course>) => void;
  addBacklog: (item: Omit<BacklogItem, "id" | "done" | "createdAt">) => void;
  toggleBacklog: (id: string) => void;
  removeBacklog: (id: string) => void;
  upsertAssessment: (a: Assessment) => void;
  removeAssessment: (id: string) => void;
  /** @deprecated Prefer setAssessmentPrep / setAssessmentSubmitted — prep ≠ submit */
  toggleAssessment: (id: string) => void;
  setAssessmentPrep: (id: string, prepDone: boolean) => void;
  setAssessmentSubmitted: (id: string, submitted: boolean) => void;
  upsertNote: (n: Note) => void;
  removeNote: (id: string) => void;
  addSession: (s: Omit<FocusSession, "id">) => void;
  ensureDayPlan: (date: string, mode?: StudyMode) => void;
  setDayMode: (date: string, mode: StudyMode) => void;
  setDayBlockDone: (date: string, blockId: string, done: boolean) => void;
  rebuildDayBlocks: (date: string) => void;
  toggleDiscipline: (id: string, date?: string) => void;
  setVaultNotes: (v: string) => void;
  upsertGradeEntry: (g: GradeEntry) => void;
  removeGradeEntry: (id: string) => void;
  upsertCourseGrade: (g: CourseGrade) => void;
  removeCourseGrade: (id: string) => void;
  upsertExamPrepTask: (t: ExamPrepTask) => void;
  toggleExamPrepTask: (id: string) => void;
  removeExamPrepTask: (id: string) => void;
  upsertWeeklyReview: (r: WeeklyReview) => void;
  /** Seed/replace study slices from VU export fixture (local only). */
  importVuStudyPlan: (plan?: VuStudyPlan) => void;
};

export type PersonalStore = PersonalState & Actions;

function emptyPlan(date: string, mode: StudyMode): DayPlan {
  return { date, mode, blocks: [] };
}

/** Split daily budget across open backlog + courses needing attention — no fake lecture math. */
function buildBlocks(
  mode: StudyMode,
  date: string,
  courses: Course[],
  backlog: BacklogItem[],
  settings: PersonalSettings,
): DayPlan["blocks"] {
  const budget = modeBudgetMinutes(mode, date, settings);
  const open = backlog.filter((b) => !b.done);
  const blocks: DayPlan["blocks"] = [];
  let left = budget;

  for (const item of open) {
    if (left <= 0) break;
    const mins = Math.min(item.estimatedMinutes || 20, left);
    blocks.push({
      id: uid(),
      courseId: item.courseId,
      minutes: mins,
      label: item.label,
      done: false,
    });
    left -= mins;
  }

  if (left > 0 && blocks.length === 0) {
    const active = courses.filter((c) => !c.isTbd || c.code !== "TBD");
    const slice = Math.max(15, Math.floor(budget / Math.max(1, Math.min(3, active.length))));
    for (const c of active.slice(0, 3)) {
      if (left <= 0) break;
      const mins = Math.min(slice, left);
      blocks.push({
        id: uid(),
        courseId: c.id,
        minutes: mins,
        label: `Study block · ${c.code}`,
        done: false,
      });
      left -= mins;
    }
  }

  return blocks;
}

export const usePersonal = create<PersonalStore>()(
  persist(
    (set, get) => ({
      authed: false,
      courses: defaultCourses(),
      backlog: [],
      assessments: defaultAssessments(),
      notes: [],
      sessions: [],
      dayPlans: {},
      discipline: defaultDiscipline(),
      settings: defaultSettings(),
      vaultNotes: "",
      gradeEntries: [],
      courseGrades: [],
      examPrepTasks: [],
      weeklyReviews: {},
      vuSeededAt: null,
      vuPlanAsOf: null,

      setAuthed: (authed) => set({ authed }),
      setSettings: (p) =>
        set((s) => {
          const next = { ...s.settings, ...p };
          if (p.weekdayMinutes != null) next.dailyTargetMinutes = p.weekdayMinutes;
          return { settings: next };
        }),
      upsertCourse: (c) =>
        set((s) => ({
          courses: s.courses.some((x) => x.id === c.id)
            ? s.courses.map((x) => (x.id === c.id ? c : x))
            : [...s.courses, c],
        })),
      updateCourse: (id, p) =>
        set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, ...p } : c)) })),
      addBacklog: (item) =>
        set((s) => ({
          backlog: [
            ...s.backlog,
            { ...item, id: uid(), done: false, createdAt: Date.now() },
          ],
        })),
      toggleBacklog: (id) =>
        set((s) => ({
          backlog: s.backlog.map((b) => (b.id === id ? { ...b, done: !b.done } : b)),
        })),
      removeBacklog: (id) => set((s) => ({ backlog: s.backlog.filter((b) => b.id !== id) })),
      upsertAssessment: (a) =>
        set((s) => {
          const next = normalizeAssessment(a);
          return {
            assessments: s.assessments.some((x) => x.id === next.id)
              ? s.assessments.map((x) => (x.id === next.id ? next : x))
              : [...s.assessments, next],
          };
        }),
      removeAssessment: (id) =>
        set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id) })),
      toggleAssessment: (id) =>
        set((s) => ({
          assessments: s.assessments.map((a) => {
            if (a.id !== id) return a;
            // Legacy toggle flips submitted only — never touches prepDone
            return withSubmitted(normalizeAssessment(a), !a.submitted && !a.done);
          }),
        })),
      setAssessmentPrep: (id, prepDone) =>
        set((s) => ({
          assessments: s.assessments.map((a) =>
            a.id === id ? withPrepDone(normalizeAssessment(a), prepDone) : a,
          ),
        })),
      setAssessmentSubmitted: (id, submitted) =>
        set((s) => ({
          assessments: s.assessments.map((a) =>
            a.id === id ? withSubmitted(normalizeAssessment(a), submitted) : a,
          ),
        })),
      upsertNote: (n) =>
        set((s) => ({
          notes: s.notes.some((x) => x.id === n.id)
            ? s.notes.map((x) => (x.id === n.id ? n : x))
            : [...s.notes, n],
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      addSession: (sIn) =>
        set((s) => ({
          sessions: [{ ...sIn, id: uid() }, ...s.sessions].slice(0, 500),
        })),
      ensureDayPlan: (date, mode) => {
        const s = get();
        if (s.dayPlans[date]) return;
        const m = mode ?? "normal";
        set({
          dayPlans: {
            ...s.dayPlans,
            [date]: {
              ...emptyPlan(date, m),
              blocks: buildBlocks(m, date, s.courses, s.backlog, s.settings),
            },
          },
        });
      },
      setDayMode: (date, mode) => {
        const s = get();
        const prev = s.dayPlans[date] ?? emptyPlan(date, mode);
        set({
          dayPlans: {
            ...s.dayPlans,
            [date]: {
              ...prev,
              mode,
              blocks: buildBlocks(mode, date, s.courses, s.backlog, s.settings),
            },
          },
        });
      },
      setDayBlockDone: (date, blockId, done) =>
        set((s) => {
          const plan = s.dayPlans[date];
          if (!plan) return s;
          return {
            dayPlans: {
              ...s.dayPlans,
              [date]: {
                ...plan,
                blocks: plan.blocks.map((b) => (b.id === blockId ? { ...b, done } : b)),
              },
            },
          };
        }),
      rebuildDayBlocks: (date) => {
        const s = get();
        const plan = s.dayPlans[date] ?? emptyPlan(date, "normal");
        set({
          dayPlans: {
            ...s.dayPlans,
            [date]: {
              ...plan,
              blocks: buildBlocks(plan.mode, date, s.courses, s.backlog, s.settings),
            },
          },
        });
      },
      toggleDiscipline: (id, date = todayIso()) =>
        set((s) => ({
          discipline: s.discipline.map((d) => {
            if (d.id !== id) return d;
            const has = d.doneDates.includes(date);
            return {
              ...d,
              doneDates: has
                ? d.doneDates.filter((x) => x !== date)
                : [...d.doneDates, date],
            };
          }),
        })),
      setVaultNotes: (vaultNotes) => set({ vaultNotes }),
      upsertGradeEntry: (g) =>
        set((s) => ({
          gradeEntries: s.gradeEntries.some((x) => x.id === g.id)
            ? s.gradeEntries.map((x) => (x.id === g.id ? g : x))
            : [...s.gradeEntries, g],
        })),
      removeGradeEntry: (id) =>
        set((s) => ({ gradeEntries: s.gradeEntries.filter((g) => g.id !== id) })),
      upsertCourseGrade: (g) =>
        set((s) => ({
          courseGrades: s.courseGrades.some((x) => x.id === g.id)
            ? s.courseGrades.map((x) => (x.id === g.id ? g : x))
            : [...s.courseGrades, g],
        })),
      removeCourseGrade: (id) =>
        set((s) => ({ courseGrades: s.courseGrades.filter((g) => g.id !== id) })),
      upsertExamPrepTask: (t) =>
        set((s) => ({
          examPrepTasks: s.examPrepTasks.some((x) => x.id === t.id)
            ? s.examPrepTasks.map((x) => (x.id === t.id ? t : x))
            : [...s.examPrepTasks, t],
        })),
      toggleExamPrepTask: (id) =>
        set((s) => ({
          examPrepTasks: s.examPrepTasks.map((t) =>
            t.id === id ? { ...t, done: !t.done } : t,
          ),
        })),
      removeExamPrepTask: (id) =>
        set((s) => ({ examPrepTasks: s.examPrepTasks.filter((t) => t.id !== id) })),
      upsertWeeklyReview: (r) =>
        set((s) => ({
          weeklyReviews: { ...s.weeklyReviews, [r.weekStart]: r },
        })),
      importVuStudyPlan: (plan = VU_STUDY_PLAN) => {
        const seed = buildVuSeed(plan);
        const s = get();
        const vaultNotes = s.vaultNotes.includes("VU export seed")
          ? s.vaultNotes
          : [s.vaultNotes.trim(), seed.vaultAppendix].filter(Boolean).join("\n\n");
        set({
          courses: seed.courses,
          assessments: seed.assessments,
          backlog: seed.backlog,
          settings: { ...s.settings, ...seed.settingsPatch },
          vaultNotes,
          vuSeededAt: new Date().toISOString(),
          vuPlanAsOf: plan.asOf,
          dayPlans: {},
        });
        // Rebuild today after seed
        const today = todayIso();
        const next = get();
        set({
          dayPlans: {
            [today]: {
              ...emptyPlan(today, "normal"),
              blocks: buildBlocks(
                "normal",
                today,
                next.courses,
                next.backlog,
                next.settings,
              ),
            },
          },
        });
      },
    }),
    {
      name: PERSONAL_STORAGE_KEY,
      partialize: (s) => ({
        courses: s.courses,
        backlog: s.backlog,
        assessments: s.assessments,
        notes: s.notes,
        sessions: s.sessions,
        dayPlans: s.dayPlans,
        discipline: s.discipline,
        settings: s.settings,
        vaultNotes: s.vaultNotes,
        gradeEntries: s.gradeEntries,
        courseGrades: s.courseGrades,
        examPrepTasks: s.examPrepTasks,
        weeklyReviews: s.weeklyReviews,
        vuSeededAt: s.vuSeededAt,
        vuPlanAsOf: s.vuPlanAsOf,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersonalState>;
        return {
          ...current,
          ...p,
          settings: migrateSettings(p.settings),
          courses: p.courses ?? current.courses,
          backlog: p.backlog ?? current.backlog,
          assessments: (p.assessments ?? current.assessments).map((a) =>
            normalizeAssessment(a),
          ),
          notes: p.notes ?? current.notes,
          sessions: p.sessions ?? current.sessions,
          dayPlans: p.dayPlans ?? current.dayPlans,
          discipline: migrateDiscipline(p.discipline ?? current.discipline),
          vaultNotes: p.vaultNotes ?? current.vaultNotes,
          gradeEntries: p.gradeEntries ?? [],
          courseGrades: p.courseGrades ?? [],
          examPrepTasks: p.examPrepTasks ?? [],
          weeklyReviews: p.weeklyReviews ?? {},
          vuSeededAt: p.vuSeededAt ?? null,
          vuPlanAsOf: p.vuPlanAsOf ?? null,
          authed: false,
        };
      },
    },
  ),
);

export function whenPersonalHydrated(): Promise<void> {
  const api = usePersonal.persist;
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = api.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export function todayKey(): string {
  return todayIso();
}

/** Analytics helpers — only real logged sessions; never invent. */
export function studyMinutesInRange(sessions: FocusSession[], fromMs: number, toMs: number) {
  return sessions
    .filter((s) => s.endedAt >= fromMs && s.startedAt <= toMs)
    .reduce((sum, s) => sum + s.minutes, 0);
}

export function consistencyDays(sessions: FocusSession[], lookbackDays: number): number {
  const set = new Set<string>();
  const now = Date.now();
  const cut = now - lookbackDays * 86400000;
  for (const s of sessions) {
    if (s.endedAt < cut) continue;
    const d = new Date(s.endedAt);
    set.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return set.size;
}

export function streakDays(sessions: FocusSession[]): number {
  if (!sessions.length) return 0;
  const days = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.endedAt);
    days.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = todayIsoFromDate(cursor);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function todayIsoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export { courseIdFromCode };
export type { DisciplineCheck };
