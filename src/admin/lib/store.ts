import { create } from "zustand";
import { persist } from "zustand/middleware";
import seed from "@/admin/data/seed.json";
import { normalizeTasks, taskDoneDays } from "./normalize-tasks";
import { appendDeptAssignment } from "./shift-assignment";
import { emptyRec, type DayRec, type Dept, type Employee, type Perf, type Settings, type Task, type TeamMember, type LogEntry } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

/** First-run defaults from attendance backup (used when localStorage key hr-attendance-v1 is empty). */
const seedData = seed as {
  depts: Dept[];
  employees: Employee[];
  records: Record<string, Record<string, DayRec>>;
  perf: Record<string, Record<string, Perf>>;
  tasks: Task[];
  settings: Settings;
  team: TeamMember[];
  logs: LogEntry[];
};

type State = {
  authed: boolean;
  depts: Dept[];
  employees: Employee[]; // array order = team order (1, 2, 3...)
  records: Record<string, Record<string, DayRec>>;
  perf: Record<string, Record<string, Perf>>;
  tasks: Task[];
  settings: Settings;
  team: TeamMember[];
  logs: LogEntry[];
  upsertMember: (m: TeamMember) => void;
  removeMember: (id: string) => void;
  addLog: (who: string, action: string) => void;
  setAuthed: (v: boolean) => void;
  upsertDept: (d: Dept) => void;
  removeDept: (id: string) => void;
  addEmployee: (e: Omit<Employee, "id">) => void;
  /** Pass `deptEffectiveFrom` (YYYY-MM-DD) with `deptId` to preserve shift history. */
  updateEmployee: (id: string, p: Partial<Employee> & { deptEffectiveFrom?: string }) => void;
  removeEmployee: (id: string) => void;
  moveEmployee: (id: string, toIndex: number) => void;
  setRec: (date: string, empId: string, p: Partial<DayRec>) => void;
  resetRec: (date: string, empId: string) => void;
  resetDay: (date: string) => void;
  setPerf: (date: string, empId: string, p: Partial<Perf>) => void;
  addTask: (t: Omit<Task, "id" | "done" | "doneDays">) => void;
  toggleTask: (id: string, day?: string) => void;
  removeTask: (id: string) => void;
  setSettings: (p: Partial<Settings>) => void;
};

const arrOf = <T,>(v: unknown, fallback: T[] = []): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
const objOf = <T extends object>(v: unknown, fallback: T): T =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as T) : fallback;

export const useApp = create<State>()(
  persist(
    (set) => ({
      authed: false,
      depts: seedData.depts,
      employees: seedData.employees,
      records: seedData.records,
      perf: seedData.perf,
      tasks: seedData.tasks,
      settings: seedData.settings,
      team: seedData.team,
      logs: seedData.logs,
      upsertMember: (m) =>
        set((s) => {
          const team = arrOf<TeamMember>(s.team);
          return {
            team: team.some((x) => x.id === m.id)
              ? team.map((x) => (x.id === m.id ? m : x))
              : [...team, m],
          };
        }),
      removeMember: (id) => set((s) => ({ team: arrOf<TeamMember>(s.team).filter((m) => m.id !== id) })),
      addLog: (who, action) =>
        set((s) => {
          const logs = arrOf<LogEntry>(s.logs);
          const now = Date.now();
          const top = logs[0];
          // merge repeated edits of the same kind within one minute
          if (top && top.who === who && top.action === action && now - top.at < 60_000)
            return { logs: [{ ...top, at: now, count: (top.count ?? 1) + 1 }, ...logs.slice(1)] };
          return { logs: [{ id: uid(), at: now, who, action }, ...logs].slice(0, 500) };
        }),
      setAuthed: (authed) => set({ authed }),
      upsertDept: (d) =>
        set((s) => {
          const depts = arrOf<Dept>(s.depts);
          return {
            depts: depts.some((x) => x.id === d.id)
              ? depts.map((x) => (x.id === d.id ? d : x))
              : [...depts, d],
          };
        }),
      removeDept: (id) => set((s) => ({ depts: arrOf<Dept>(s.depts).filter((d) => d.id !== id) })),
      addEmployee: (e) =>
        set((s) => {
          const id = uid();
          const joinRaw =
            e.joinMonth == null
              ? ""
              : typeof e.joinMonth === "string"
                ? e.joinMonth
                : String(e.joinMonth);
          const joinMonth =
            /^\d{4}-\d{2}/.test(joinRaw) ? joinRaw.slice(0, 7) : new Date().toISOString().slice(0, 7);
          const effectiveFrom = `${joinMonth}-01`;
          const emp: Employee = {
            ...e,
            id,
            deptAssignments:
              Array.isArray(e.deptAssignments) && e.deptAssignments.length
                ? e.deptAssignments
                : [{ deptId: e.deptId, effectiveFrom }],
          };
          return { employees: [...arrOf<Employee>(s.employees), emp] };
        }),
      updateEmployee: (id, p) =>
        set((s) => ({
          employees: arrOf<Employee>(s.employees).map((e) => {
            if (e.id !== id) return e;
            const { deptEffectiveFrom, ...rest } = p;
            if (rest.deptId != null && rest.deptId !== e.deptId) {
              const effectiveFrom =
                typeof deptEffectiveFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deptEffectiveFrom)
                  ? deptEffectiveFrom
                  : new Date().toISOString().slice(0, 10);
              const hist = appendDeptAssignment(e, rest.deptId, effectiveFrom);
              return { ...e, ...rest, ...hist };
            }
            return { ...e, ...rest };
          }),
        })),
      removeEmployee: (id) =>
        set((s) => ({ employees: arrOf<Employee>(s.employees).filter((e) => e.id !== id) })),
      moveEmployee: (id, to) =>
        set((s) => {
          const list = [...arrOf<Employee>(s.employees)];
          const from = list.findIndex((e) => e.id === id);
          if (from < 0) return s;
          const it = list.splice(from, 1)[0]!;
          list.splice(Math.max(0, Math.min(list.length, to)), 0, it);
          return { employees: list };
        }),
      setRec: (date, empId, p) =>
        set((s) => {
          const records = objOf(s.records, {} as State["records"]);
          const day = records[date] ?? {};
          return { records: { ...records, [date]: { ...day, [empId]: { ...(day[empId] ?? emptyRec()), ...p } } } };
        }),
      resetRec: (date, empId) =>
        set((s) => {
          const records = objOf(s.records, {} as State["records"]);
          const day = { ...(records[date] ?? {}) };
          delete day[empId];
          return { records: { ...records, [date]: day } };
        }),
      resetDay: (date) =>
        set((s) => {
          const r = { ...objOf(s.records, {} as State["records"]) };
          delete r[date];
          return { records: r };
        }),
      setPerf: (date, empId, p) =>
        set((s) => {
          const perf = objOf(s.perf, {} as State["perf"]);
          const day = perf[date] ?? {};
          return { perf: { ...perf, [date]: { ...day, [empId]: { ...(day[empId] ?? { rating: "", note: "" }), ...p } } } };
        }),
      addTask: (t) =>
        set((s) => ({
          tasks: [...normalizeTasks(s.tasks), { ...t, id: uid(), done: false, doneDays: [] }],
        })),
      toggleTask: (id, day) =>
        set((s) => ({
          tasks: normalizeTasks(s.tasks).map((t) => {
            if (t.id !== id) return t;
            if (t.kind === "dated") return { ...t, done: !t.done };
            const days = taskDoneDays(t);
            const has = days.includes(day!);
            return { ...t, doneDays: has ? days.filter((d) => d !== day) : [...days, day!] };
          }),
        })),
      removeTask: (id) => set((s) => ({ tasks: normalizeTasks(s.tasks).filter((t) => t.id !== id) })),
      setSettings: (p) =>
        set((s) => ({
          settings: { ...objOf(s.settings, seedData.settings), ...p },
        })),
    }),
    {
      name: "hr-attendance-v1",
      // Heal legacy / cloud tasks missing doneDays before TaskGate mounts.
      merge: (persisted, current) => {
        const p =
          persisted && typeof persisted === "object" && !Array.isArray(persisted)
            ? (persisted as Partial<State>)
            : {};
        const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
        const obj = <T extends object>(v: unknown, fallback: T): T =>
          v && typeof v === "object" && !Array.isArray(v) ? (v as T) : fallback;
        return {
          ...current,
          ...p,
          tasks: normalizeTasks(arr(p.tasks, current.tasks)),
          employees: arr(p.employees, current.employees),
          team: arr(p.team, current.team),
          depts: arr(p.depts, current.depts),
          logs: arr(p.logs, current.logs),
          records: obj(p.records, current.records),
          perf: obj(p.perf, current.perf),
          settings: obj(p.settings, current.settings),
        };
      },
    },
  ),
);

/** Resolves after zustand persist has rehydrated from localStorage (or immediately if already done). */
export function whenAttendanceHydrated(): Promise<void> {
  const api = useApp.persist;
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = api.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
