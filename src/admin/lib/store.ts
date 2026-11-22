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
const asText = (v: unknown): string => (v == null ? "" : typeof v === "string" ? v : String(v));

/** Coerce employee scalars from corrupt cloud/local persist before UI `.name` / joinMonth use. */
export function normalizeEmployee(raw: Partial<Employee> & Pick<Employee, "id">): Employee {
  const joinRaw = asText(raw.joinMonth);
  const joinMonth = /^\d{4}-\d{2}/.test(joinRaw)
    ? joinRaw.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  const opening =
    typeof raw.openingLeave === "number" && Number.isFinite(raw.openingLeave)
      ? raw.openingLeave
      : Number.isFinite(Number(raw.openingLeave))
        ? Number(raw.openingLeave)
        : 0;
  return {
    id: asText(raw.id) || uid(),
    name: asText(raw.name),
    deptId: asText(raw.deptId),
    afterHours: Boolean(raw.afterHours),
    joinMonth,
    openingLeave: opening,
    ...(Array.isArray(raw.deptAssignments) ? { deptAssignments: raw.deptAssignments } : {}),
  };
}

/** Coerce team ACL row scalars before email/name compares. */
export function normalizeTeamMember(raw: Partial<TeamMember> & Pick<TeamMember, "id">): TeamMember {
  const role = raw.role === "admin" || raw.role === "standard" ? raw.role : "standard";
  return {
    id: asText(raw.id) || uid(),
    name: asText(raw.name),
    email: asText(raw.email).trim().toLowerCase(),
    role,
    active: raw.active !== false,
  };
}

/** Coerce department name/shift minutes from corrupt persist. */
export function normalizeDept(raw: Partial<Dept> & Pick<Dept, "id">): Dept {
  const asMin = (v: unknown, fallback: number): number => {
    if (v == null || v === "") return fallback;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    id: asText(raw.id) || uid(),
    name: asText(raw.name),
    start: asMin(raw.start, 540),
    end: asMin(raw.end, 1140),
  };
}

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
          const next = normalizeTeamMember(m);
          return {
            team: team.some((x) => x.id === next.id)
              ? team.map((x) => (x.id === next.id ? next : x))
              : [...team, next],
          };
        }),
      removeMember: (id) => set((s) => ({ team: arrOf<TeamMember>(s.team).filter((m) => m.id !== id) })),
      addLog: (who, action) =>
        set((s) => {
          const logs = arrOf<LogEntry>(s.logs);
          const now = Date.now();
          const whoText = asText(who);
          const actionText = asText(action);
          const top = logs[0];
          // merge repeated edits of the same kind within one minute
          if (top && top.who === whoText && top.action === actionText && now - top.at < 60_000)
            return { logs: [{ ...top, at: now, count: (top.count ?? 1) + 1 }, ...logs.slice(1)] };
          return { logs: [{ id: uid(), at: now, who: whoText, action: actionText }, ...logs].slice(0, 500) };
        }),
      setAuthed: (authed) => set({ authed }),
      upsertDept: (d) =>
        set((s) => {
          const depts = arrOf<Dept>(s.depts);
          const next = normalizeDept(d);
          return {
            depts: depts.some((x) => x.id === next.id)
              ? depts.map((x) => (x.id === next.id ? next : x))
              : [...depts, next],
          };
        }),
      removeDept: (id) => set((s) => ({ depts: arrOf<Dept>(s.depts).filter((d) => d.id !== id) })),
      addEmployee: (e) =>
        set((s) => {
          const id = uid();
          const base = normalizeEmployee({ ...e, id });
          const effectiveFrom = `${base.joinMonth}-01`;
          const emp: Employee = {
            ...base,
            deptAssignments:
              Array.isArray(e.deptAssignments) && e.deptAssignments.length
                ? e.deptAssignments
                : [{ deptId: base.deptId, effectiveFrom }],
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
              const hist = appendDeptAssignment(e, asText(rest.deptId), effectiveFrom);
              return normalizeEmployee({ ...e, ...rest, ...hist, id: e.id });
            }
            return normalizeEmployee({ ...e, ...rest, id: e.id });
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
          const merged: DayRec = { ...(day[empId] ?? emptyRec()), ...p };
          if ("note" in p) merged.note = asText(p.note);
          if ("halfReason" in p) merged.halfReason = asText(p.halfReason);
          return { records: { ...records, [date]: { ...day, [empId]: merged } } };
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
          const merged: Perf = { ...(day[empId] ?? { rating: "", note: "" }), ...p };
          if ("note" in p) merged.note = asText(p.note);
          if ("rating" in p) {
            const r = asText(p.rating);
            merged.rating = (
              r === "excellent" || r === "good" || r === "average" || r === "needs" || r === "poor" ? r : ""
            ) as Perf["rating"];
          }
          return { perf: { ...perf, [date]: { ...day, [empId]: merged } } };
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
          employees: arr(p.employees, current.employees)
            .filter((e): e is Employee => !!e && typeof e === "object" && !Array.isArray(e))
            .map((e) => normalizeEmployee(e as Employee)),
          team: arr(p.team, current.team)
            .filter((m): m is TeamMember => !!m && typeof m === "object" && !Array.isArray(m))
            .map((m) => normalizeTeamMember(m as TeamMember)),
          depts: arr(p.depts, current.depts)
            .filter((d): d is Dept => !!d && typeof d === "object" && !Array.isArray(d))
            .map((d) => normalizeDept(d as Dept)),
          logs: arr(p.logs, current.logs)
            .filter((l): l is LogEntry => !!l && typeof l === "object" && !Array.isArray(l))
            .map((l) => ({
              ...l,
              id: asText((l as LogEntry).id) || uid(),
              who: asText((l as LogEntry).who),
              action: asText((l as LogEntry).action),
              at:
                typeof (l as LogEntry).at === "number" && Number.isFinite((l as LogEntry).at)
                  ? (l as LogEntry).at
                  : Number.isFinite(Number((l as LogEntry).at))
                    ? Number((l as LogEntry).at)
                    : Date.now(),
            })),
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
