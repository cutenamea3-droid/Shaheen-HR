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
import {
  normalizeAssessment,
  normalizeBacklogItem,
  normalizeCourse,
  normalizeCourseGrade,
  normalizeExamPrepTask,
  normalizeFocusSession,
  normalizeGradeEntry,
  normalizeNote,
  withPrepDone,
  withSubmitted,
} from "./assessment-phases";
import { modeBudgetMinutes } from "./schedule";
import { buildVuSeed } from "./vu-import";
import { VU_STUDY_PLAN, courseIdFromCode, type VuStudyPlan } from "./vu-plan";
import { normalizeWeeklyReview, normalizeWeeklyReviews } from "./weekly-review";

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

/** Safe blocks array for a day plan — corrupt persist/cloud never crashes .map/.reduce. */
export function blocksOf(plan: { blocks?: unknown } | null | undefined): DayPlan["blocks"] {
  if (!Array.isArray(plan?.blocks)) return [];
  const asText = (v: unknown, fb = "") =>
    v == null ? fb : typeof v === "string" ? v : String(v);
  const out: DayPlan["blocks"] = [];
  for (const raw of plan!.blocks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const b = raw as Record<string, unknown>;
    const mins = Number(b.minutes);
    out.push({
      id: asText(b.id) || uid(),
      courseId: asText(b.courseId, "general") || "general",
      minutes: Number.isFinite(mins) && mins >= 0 ? mins : 0,
      label: asText(b.label),
      done: Boolean(b.done),
    });
  }
  return out;
}

function healDayPlans(raw: unknown, fallback: PersonalState["dayPlans"]): PersonalState["dayPlans"] {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, DayPlan>)
      : fallback;
  const out: PersonalState["dayPlans"] = {};
  for (const [dateKey, plan] of Object.entries(src)) {
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) continue;
    const date =
      plan.date == null
        ? String(dateKey)
        : typeof plan.date === "string"
          ? plan.date
          : String(plan.date || dateKey);
    out[date] = {
      date,
      mode: plan.mode === "busy" || plan.mode === "rescue" ? plan.mode : "normal",
      blocks: blocksOf(plan),
    };
  }
  return out;
}

/** Split daily budget across open backlog + courses needing attention — no fake lecture math. */
function buildBlocks(
  mode: StudyMode,
  date: string,
  courses: Course[],
  backlog: BacklogItem[],
  settings: PersonalSettings,
): DayPlan["blocks"] {
  const courseList = Array.isArray(courses) ? courses : [];
  const backlogList = Array.isArray(backlog) ? backlog : [];
  const budget = modeBudgetMinutes(mode, date, settings);
  const open = backlogList.filter((b) => !b.done);
  const blocks: DayPlan["blocks"] = [];
  let left = budget;

  const asText = (v: unknown, fb = "") =>
    v == null ? fb : typeof v === "string" ? v : String(v);
  for (const item of open) {
    if (left <= 0) break;
    const mins = Math.min(item.estimatedMinutes || 20, left);
    blocks.push({
      id: uid(),
      courseId: asText(item.courseId, "general") || "general",
      minutes: mins,
      label: asText(item.label),
      done: false,
    });
    left -= mins;
  }

  if (left > 0 && blocks.length === 0) {
    const active = courseList.filter((c) => !c.isTbd || asText(c.code) !== "TBD");
    const slice = Math.max(15, Math.floor(budget / Math.max(1, Math.min(3, active.length))));
    for (const c of active.slice(0, 3)) {
      if (left <= 0) break;
      const mins = Math.min(slice, left);
      blocks.push({
        id: uid(),
        courseId: asText(c.id),
        minutes: mins,
        label: `Study block · ${asText(c.code)}`,
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
          const patch = p && typeof p === "object" && !Array.isArray(p) ? p : {};
          const next = migrateSettings({ ...migrateSettings(s.settings), ...patch });
          if (patch.weekdayMinutes != null) next.dailyTargetMinutes = patch.weekdayMinutes;
          return { settings: next };
        }),
      upsertCourse: (c) =>
        set((s) => {
          const courses = Array.isArray(s.courses) ? s.courses : [];
          return {
            courses: courses.some((x) => x.id === c.id)
              ? courses.map((x) => (x.id === c.id ? c : x))
              : [...courses, c],
          };
        }),
      updateCourse: (id, p) =>
        set((s) => {
          const courses = Array.isArray(s.courses) ? s.courses : [];
          return {
            courses: courses.map((c) =>
              c.id === id ? normalizeCourse({ ...c, ...p, id: c.id }) : c,
            ),
          };
        }),
      addBacklog: (item) =>
        set((s) => {
          const backlog = Array.isArray(s.backlog) ? s.backlog : [];
          const next = normalizeBacklogItem({
            ...item,
            id: uid(),
            done: false,
            createdAt: Date.now(),
          });
          return { backlog: [...backlog, next] };
        }),
      toggleBacklog: (id) =>
        set((s) => {
          const backlog = Array.isArray(s.backlog) ? s.backlog : [];
          return { backlog: backlog.map((b) => (b.id === id ? { ...b, done: !b.done } : b)) };
        }),
      removeBacklog: (id) =>
        set((s) => {
          const backlog = Array.isArray(s.backlog) ? s.backlog : [];
          return { backlog: backlog.filter((b) => b.id !== id) };
        }),
      upsertAssessment: (a) =>
        set((s) => {
          const next = normalizeAssessment(a);
          const assessments = Array.isArray(s.assessments) ? s.assessments : [];
          return {
            assessments: assessments.some((x) => x.id === next.id)
              ? assessments.map((x) => (x.id === next.id ? next : x))
              : [...assessments, next],
          };
        }),
      removeAssessment: (id) =>
        set((s) => {
          const assessments = Array.isArray(s.assessments) ? s.assessments : [];
          return { assessments: assessments.filter((a) => a.id !== id) };
        }),
      toggleAssessment: (id) =>
        set((s) => {
          const assessments = Array.isArray(s.assessments) ? s.assessments : [];
          return {
            assessments: assessments.map((a) => {
              if (a.id !== id) return a;
              // Legacy toggle flips submitted only — never touches prepDone
              return withSubmitted(normalizeAssessment(a), !a.submitted && !a.done);
            }),
          };
        }),
      setAssessmentPrep: (id, prepDone) =>
        set((s) => {
          const assessments = Array.isArray(s.assessments) ? s.assessments : [];
          return {
            assessments: assessments.map((a) =>
              a.id === id ? withPrepDone(normalizeAssessment(a), prepDone) : a,
            ),
          };
        }),
      setAssessmentSubmitted: (id, submitted) =>
        set((s) => {
          const assessments = Array.isArray(s.assessments) ? s.assessments : [];
          return {
            assessments: assessments.map((a) =>
              a.id === id ? withSubmitted(normalizeAssessment(a), submitted) : a,
            ),
          };
        }),
      upsertNote: (n) =>
        set((s) => {
          const notes = Array.isArray(s.notes) ? s.notes : [];
          const next = normalizeNote(n);
          return {
            notes: notes.some((x) => x.id === next.id)
              ? notes.map((x) => (x.id === next.id ? next : x))
              : [...notes, next],
          };
        }),
      removeNote: (id) =>
        set((s) => {
          const notes = Array.isArray(s.notes) ? s.notes : [];
          return { notes: notes.filter((n) => n.id !== id) };
        }),
      addSession: (sIn) =>
        set((s) => {
          const sessions = Array.isArray(s.sessions) ? s.sessions : [];
          const next = normalizeFocusSession({ ...sIn, id: uid() });
          return { sessions: [next, ...sessions].slice(0, 500) };
        }),
      ensureDayPlan: (date, mode) => {
        const s = get();
        const dayPlans =
          s.dayPlans && typeof s.dayPlans === "object" && !Array.isArray(s.dayPlans) ? s.dayPlans : {};
        if (dayPlans[date]) return;
        const m = mode ?? "normal";
        set({
          dayPlans: {
            ...dayPlans,
            [date]: {
              ...emptyPlan(date, m),
              blocks: buildBlocks(m, date, s.courses, s.backlog, s.settings),
            },
          },
        });
      },
      setDayMode: (date, mode) => {
        const s = get();
        const dayPlans =
          s.dayPlans && typeof s.dayPlans === "object" && !Array.isArray(s.dayPlans) ? s.dayPlans : {};
        const prev = dayPlans[date] ?? emptyPlan(date, mode);
        set({
          dayPlans: {
            ...dayPlans,
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
          const dayPlans =
            s.dayPlans && typeof s.dayPlans === "object" && !Array.isArray(s.dayPlans) ? s.dayPlans : {};
          const plan = dayPlans[date];
          if (!plan) return s;
          return {
            dayPlans: {
              ...dayPlans,
              [date]: {
                ...plan,
                blocks: blocksOf(plan).map((b) => (b.id === blockId ? { ...b, done } : b)),
              },
            },
          };
        }),
      rebuildDayBlocks: (date) => {
        const s = get();
        const dayPlans =
          s.dayPlans && typeof s.dayPlans === "object" && !Array.isArray(s.dayPlans) ? s.dayPlans : {};
        const plan = dayPlans[date] ?? emptyPlan(date, "normal");
        set({
          dayPlans: {
            ...dayPlans,
            [date]: {
              ...plan,
              blocks: buildBlocks(plan.mode, date, s.courses, s.backlog, s.settings),
            },
          },
        });
      },
      toggleDiscipline: (id, date = todayIso()) =>
        set((s) => ({
          discipline: (Array.isArray(s.discipline) ? s.discipline : []).map((d) => {
            if (d.id !== id) return d;
            const doneDates = Array.isArray(d.doneDates) ? d.doneDates : [];
            const has = doneDates.includes(date);
            return {
              ...d,
              doneDates: has ? doneDates.filter((x) => x !== date) : [...doneDates, date],
            };
          }),
        })),
      setVaultNotes: (vaultNotes) =>
        set({
          vaultNotes:
            vaultNotes == null ? "" : typeof vaultNotes === "string" ? vaultNotes : String(vaultNotes),
        }),
      upsertGradeEntry: (g) =>
        set((s) => {
          const gradeEntries = Array.isArray(s.gradeEntries) ? s.gradeEntries : [];
          const next = normalizeGradeEntry(g);
          return {
            gradeEntries: gradeEntries.some((x) => x.id === next.id)
              ? gradeEntries.map((x) => (x.id === next.id ? next : x))
              : [...gradeEntries, next],
          };
        }),
      removeGradeEntry: (id) =>
        set((s) => {
          const gradeEntries = Array.isArray(s.gradeEntries) ? s.gradeEntries : [];
          return { gradeEntries: gradeEntries.filter((g) => g.id !== id) };
        }),
      upsertCourseGrade: (g) =>
        set((s) => {
          const courseGrades = Array.isArray(s.courseGrades) ? s.courseGrades : [];
          const next = normalizeCourseGrade(g);
          return {
            courseGrades: courseGrades.some((x) => x.id === next.id)
              ? courseGrades.map((x) => (x.id === next.id ? next : x))
              : [...courseGrades, next],
          };
        }),
      removeCourseGrade: (id) =>
        set((s) => {
          const courseGrades = Array.isArray(s.courseGrades) ? s.courseGrades : [];
          return { courseGrades: courseGrades.filter((g) => g.id !== id) };
        }),
      upsertExamPrepTask: (t) =>
        set((s) => {
          const examPrepTasks = Array.isArray(s.examPrepTasks) ? s.examPrepTasks : [];
          const next = normalizeExamPrepTask(t);
          return {
            examPrepTasks: examPrepTasks.some((x) => x.id === next.id)
              ? examPrepTasks.map((x) => (x.id === next.id ? next : x))
              : [...examPrepTasks, next],
          };
        }),
      toggleExamPrepTask: (id) =>
        set((s) => {
          const examPrepTasks = Array.isArray(s.examPrepTasks) ? s.examPrepTasks : [];
          return {
            examPrepTasks: examPrepTasks.map((t) =>
              t.id === id ? normalizeExamPrepTask({ ...t, done: !t.done }) : t,
            ),
          };
        }),
      removeExamPrepTask: (id) =>
        set((s) => {
          const examPrepTasks = Array.isArray(s.examPrepTasks) ? s.examPrepTasks : [];
          return { examPrepTasks: examPrepTasks.filter((t) => t.id !== id) };
        }),
      upsertWeeklyReview: (r) =>
        set((s) => {
          const weeklyReviews =
            s.weeklyReviews && typeof s.weeklyReviews === "object" && !Array.isArray(s.weeklyReviews)
              ? s.weeklyReviews
              : {};
          const next = normalizeWeeklyReview(r, r.weekStart);
          return { weeklyReviews: { ...weeklyReviews, [next.weekStart]: next } };
        }),
      importVuStudyPlan: (plan = VU_STUDY_PLAN) => {
        const seed = buildVuSeed(plan);
        const s = get();
        const prevVault = typeof s.vaultNotes === "string" ? s.vaultNotes : "";
        const vaultNotes = prevVault.includes("VU export seed")
          ? prevVault
          : [prevVault.trim(), seed.vaultAppendix].filter(Boolean).join("\n\n");
        set({
          courses: seed.courses,
          assessments: seed.assessments,
          backlog: seed.backlog,
          settings: migrateSettings({
            ...migrateSettings(s.settings),
            ...(seed.settingsPatch && typeof seed.settingsPatch === "object" && !Array.isArray(seed.settingsPatch)
              ? seed.settingsPatch
              : {}),
          }),
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
        const raw =
          persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? (persisted as Partial<PersonalState>)
            : {};
        const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
        const obj = <T extends object>(v: unknown, fallback: T): T =>
          v && typeof v === "object" && !Array.isArray(v) ? (v as T) : fallback;
        return {
          ...current,
          ...raw,
          settings: migrateSettings(raw.settings),
          courses: arr(raw.courses, current.courses).map((c) =>
            normalizeCourse(c as Partial<Course> & Pick<Course, "id">),
          ),
          backlog: arr(raw.backlog, current.backlog).map((b) =>
            normalizeBacklogItem(b as Partial<BacklogItem> & Pick<BacklogItem, "id">),
          ),
          assessments: arr(raw.assessments, current.assessments).map((a) => normalizeAssessment(a)),
          notes: arr(raw.notes, current.notes).map((n) =>
            normalizeNote(n as Partial<Note> & Pick<Note, "id">),
          ),
          sessions: arr(raw.sessions, current.sessions).map((s) =>
            normalizeFocusSession(s as Partial<FocusSession> & Pick<FocusSession, "id">),
          ),
          dayPlans: healDayPlans(raw.dayPlans, current.dayPlans),
          discipline: migrateDiscipline(arr(raw.discipline, current.discipline)),
          vaultNotes:
            raw.vaultNotes == null
              ? current.vaultNotes
              : typeof raw.vaultNotes === "string"
                ? raw.vaultNotes
                : String(raw.vaultNotes),
          gradeEntries: arr(raw.gradeEntries, []).map((g) =>
            normalizeGradeEntry(g as Partial<GradeEntry> & Pick<GradeEntry, "id">),
          ),
          courseGrades: arr(raw.courseGrades, []).map((g) =>
            normalizeCourseGrade(g as Partial<CourseGrade> & Pick<CourseGrade, "id">),
          ),
          examPrepTasks: arr(raw.examPrepTasks, []).map((t) =>
            normalizeExamPrepTask(t as Partial<ExamPrepTask> & Pick<ExamPrepTask, "id">),
          ),
          weeklyReviews: normalizeWeeklyReviews(
            raw.weeklyReviews,
            current.weeklyReviews ?? {},
          ),
          vuSeededAt: raw.vuSeededAt ?? null,
          vuPlanAsOf: raw.vuPlanAsOf ?? null,
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
  const list = Array.isArray(sessions) ? sessions : [];
  return list
    .filter((s) => s.endedAt >= fromMs && s.startedAt <= toMs)
    .reduce((sum, s) => sum + s.minutes, 0);
}

export function consistencyDays(sessions: FocusSession[], lookbackDays: number): number {
  const list = Array.isArray(sessions) ? sessions : [];
  const set = new Set<string>();
  const now = Date.now();
  const cut = now - lookbackDays * 86400000;
  for (const s of list) {
    if (s.endedAt < cut) continue;
    const d = new Date(s.endedAt);
    set.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return set.size;
}

export function streakDays(sessions: FocusSession[]): number {
  const list = Array.isArray(sessions) ? sessions : [];
  if (!list.length) return 0;
  const days = new Set<string>();
  for (const s of list) {
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
