import { create } from "zustand";
import { persist } from "zustand/middleware";
import seed from "@/admin/data/seed.json";
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
        set((s) => ({ team: s.team.some((x) => x.id === m.id) ? s.team.map((x) => (x.id === m.id ? m : x)) : [...s.team, m] })),
      removeMember: (id) => set((s) => ({ team: s.team.filter((m) => m.id !== id) })),
      addLog: (who, action) =>
        set((s) => {
          const now = Date.now();
          const top = s.logs[0];
          // merge repeated edits of the same kind within one minute
          if (top && top.who === who && top.action === action && now - top.at < 60_000)
            return { logs: [{ ...top, at: now, count: (top.count ?? 1) + 1 }, ...s.logs.slice(1)] };
          return { logs: [{ id: uid(), at: now, who, action }, ...s.logs].slice(0, 500) };
        }),
      setAuthed: (authed) => set({ authed }),
      upsertDept: (d) =>
        set((s) => ({ depts: s.depts.some((x) => x.id === d.id) ? s.depts.map((x) => (x.id === d.id ? d : x)) : [...s.depts, d] })),
      removeDept: (id) => set((s) => ({ depts: s.depts.filter((d) => d.id !== id) })),
      addEmployee: (e) =>
        set((s) => {
          const id = uid();
          const effectiveFrom = `${(e.joinMonth || new Date().toISOString().slice(0, 7))}-01`;
          const emp: Employee = {
            ...e,
            id,
            deptAssignments: e.deptAssignments?.length
              ? e.deptAssignments
              : [{ deptId: e.deptId, effectiveFrom }],
          };
          return { employees: [...s.employees, emp] };
        }),
      updateEmployee: (id, p) =>
        set((s) => ({
          employees: s.employees.map((e) => {
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
      removeEmployee: (id) => set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),
      moveEmployee: (id, to) =>
        set((s) => {
          const list = [...s.employees];
          const from = list.findIndex((e) => e.id === id);
          if (from < 0) return s;
          const it = list.splice(from, 1)[0]!;
          list.splice(Math.max(0, Math.min(list.length, to)), 0, it);
          return { employees: list };
        }),
      setRec: (date, empId, p) =>
        set((s) => {
          const day = s.records[date] ?? {};
          return { records: { ...s.records, [date]: { ...day, [empId]: { ...(day[empId] ?? emptyRec()), ...p } } } };
        }),
      resetRec: (date, empId) =>
        set((s) => {
          const day = { ...(s.records[date] ?? {}) };
          delete day[empId];
          return { records: { ...s.records, [date]: day } };
        }),
      resetDay: (date) =>
        set((s) => {
          const r = { ...s.records };
          delete r[date];
          return { records: r };
        }),
      setPerf: (date, empId, p) =>
        set((s) => {
          const day = s.perf[date] ?? {};
          return { perf: { ...s.perf, [date]: { ...day, [empId]: { ...(day[empId] ?? { rating: "", note: "" }), ...p } } } };
        }),
      addTask: (t) => set((s) => ({ tasks: [...s.tasks, { ...t, id: uid(), done: false, doneDays: [] }] })),
      toggleTask: (id, day) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            if (t.kind === "dated") return { ...t, done: !t.done };
            const has = t.doneDays.includes(day!);
            return { ...t, doneDays: has ? t.doneDays.filter((d) => d !== day) : [...t.doneDays, day!] };
          }),
        })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
    }),
    { name: "hr-attendance-v1" },
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
