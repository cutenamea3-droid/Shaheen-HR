import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultAssessments,
  defaultCourses,
  defaultDiscipline,
  defaultSettings,
  migrateSettings,
  PERSONAL_STORAGE_KEY,
} from "./defaults";
import type {
  Assessment,
  BacklogItem,
  Course,
  DayPlan,
  DisciplineCheck,
  FocusSession,
  Note,
  PersonalSettings,
  PersonalState,
  StudyMode,
} from "./types";
import { modeBudgetMinutes } from "./schedule";

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
  toggleAssessment: (id: string) => void;
  upsertNote: (n: Note) => void;
  removeNote: (id: string) => void;
  addSession: (s: Omit<FocusSession, "id">) => void;
  ensureDayPlan: (date: string, mode?: StudyMode) => void;
  setDayMode: (date: string, mode: StudyMode) => void;
  setDayBlockDone: (date: string, blockId: string, done: boolean) => void;
  rebuildDayBlocks: (date: string) => void;
  toggleDiscipline: (id: string, date?: string) => void;
  setVaultNotes: (v: string) => void;
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
    // Gentle placeholder study slots — not progress claims
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
        set((s) => ({
          assessments: s.assessments.some((x) => x.id === a.id)
            ? s.assessments.map((x) => (x.id === a.id ? a : x))
            : [...s.assessments, a],
        })),
      removeAssessment: (id) =>
        set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id) })),
      toggleAssessment: (id) =>
        set((s) => ({
          assessments: s.assessments.map((a) =>
            a.id === id ? { ...a, done: !a.done } : a,
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
    }),
    {
      name: PERSONAL_STORAGE_KEY,
      // Never persist gate state — session key alone unlocks after refresh.
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
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersonalState>;
        return {
          ...current,
          ...p,
          settings: migrateSettings(p.settings),
          // Preserve user timetable / progress blobs when present.
          courses: p.courses ?? current.courses,
          backlog: p.backlog ?? current.backlog,
          assessments: p.assessments ?? current.assessments,
          notes: p.notes ?? current.notes,
          sessions: p.sessions ?? current.sessions,
          dayPlans: p.dayPlans ?? current.dayPlans,
          discipline: p.discipline ?? current.discipline,
          vaultNotes: p.vaultNotes ?? current.vaultNotes,
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

export type { DisciplineCheck };
