/**
 * Performance & Follow-Ups — facts ≠ statements ≠ assessment.
 *
 * - Facts: derived only from attendance calcDay / shift variance (never invented).
 * - Statements: recorded human text (attendance notes / HR statements).
 * - Assessment: rating judgment — labeled separately; never auto-filled from facts.
 *
 * Follow-ups are desk reminders linked to an employee — not push/email.
 * Dedicated local key — never HR_SYNC_KEYS / banking / salary.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calcDay } from "./calc";
import { resolveDeptAsOf } from "./shift-assignment";
import { shiftVariance } from "./shift-variance";
import { RATING_LABEL, type DayRec, type Dept, type Employee, type Perf, type Rating, type Settings } from "./types";

export type PerfLayer = "fact" | "statement" | "assessment";

export const PERF_LAYER_LABEL: Record<PerfLayer, string> = {
  fact: "Fact (from attendance)",
  statement: "Statement (recorded text)",
  assessment: "Assessment (HR rating)",
};

export type PerfFact = {
  layer: "fact";
  date: string;
  employeeId: string;
  kind: string;
  detail: string;
};

export type PerfStatementView = {
  layer: "statement";
  date: string;
  employeeId: string;
  source: "attendance_note" | "performance_note" | "hr_statement";
  text: string;
};

export type PerfAssessmentView = {
  layer: "assessment";
  date: string;
  employeeId: string;
  rating: Rating | "";
  ratingLabel: string;
};

export type PerfFollowUpStatus = "open" | "done";

export type PerfFollowUp = {
  id: string;
  employeeId: string;
  employeeName: string;
  due: string;
  title: string;
  status: PerfFollowUpStatus;
  linkedDate: string;
  note: string;
  createdAt: number;
  completedAt: number | null;
};

/** Optional HR statements (separate from attendance/perf notes). */
export type HrStatement = {
  id: string;
  employeeId: string;
  date: string;
  text: string;
  createdAt: number;
};

export const PERF_FOLLOWUPS_STORAGE_KEY = "hr-perf-followups-v1";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Collect attendance facts for one employee/day — only from calc, never invented.
 */
export function collectPerfFacts(input: {
  employee: Employee;
  depts: Dept[];
  date: string;
  rec: DayRec;
  settings: Settings;
}): PerfFact[] {
  const { employee, depts, date, rec, settings } = input;
  const dept = resolveDeptAsOf(employee, depts, date);
  const c = calcDay(employee, dept, date, rec, settings);
  const v = shiftVariance(dept, rec, { grace: settings.grace, date, employee });
  const facts: PerfFact[] = [];
  const base = { layer: "fact" as const, date, employeeId: employee.id };

  if (rec.status === "absent") facts.push({ ...base, kind: "Absent", detail: "Marked absent" });
  if (rec.status === "leave")
    facts.push({
      ...base,
      kind: rec.leavePaid ? "Paid leave" : "Unpaid leave",
      detail: "Leave on attendance",
    });
  if (rec.status === "half")
    facts.push({ ...base, kind: "Half day", detail: rec.halfReason || "Half day" });
  if (c.lateLevel === "late") facts.push({ ...base, kind: "Late (after grace)", detail: `${c.lateMin}m` });
  if (c.lateLevel === "grace") facts.push({ ...base, kind: "Within grace", detail: `${c.lateMin}m` });
  if (v.earlyOutMin > 0) facts.push({ ...base, kind: "Early out", detail: `${v.earlyOutMin}m` });
  if (c.breakLevel === "over") facts.push({ ...base, kind: "Over break", detail: `${c.overBreak}m` });
  if (c.missPunch) facts.push({ ...base, kind: "Miss punch", detail: c.missing.join(", ") || "miss" });
  if (c.overtimeMin > 0) facts.push({ ...base, kind: "OT marked hours", detail: `${(c.overtimeMin / 60).toFixed(2)}h` });
  if (c.extraDay) facts.push({ ...base, kind: "Additional day", detail: `${(c.extraDayMin / 60).toFixed(2)}h` });

  return facts;
}

export function collectPerfStatements(input: {
  employeeId: string;
  date: string;
  rec?: DayRec;
  perf?: Perf;
  hrStatements?: HrStatement[];
}): PerfStatementView[] {
  const out: PerfStatementView[] = [];
  if (input.rec?.note?.trim()) {
    out.push({
      layer: "statement",
      date: input.date,
      employeeId: input.employeeId,
      source: "attendance_note",
      text: input.rec.note.trim(),
    });
  }
  if (input.perf?.note?.trim()) {
    out.push({
      layer: "statement",
      date: input.date,
      employeeId: input.employeeId,
      source: "performance_note",
      text: input.perf.note.trim(),
    });
  }
  for (const s of input.hrStatements ?? []) {
    if (s.employeeId === input.employeeId && s.date === input.date && s.text.trim()) {
      out.push({
        layer: "statement",
        date: input.date,
        employeeId: input.employeeId,
        source: "hr_statement",
        text: s.text.trim(),
      });
    }
  }
  return out;
}

export function collectPerfAssessment(input: {
  employeeId: string;
  date: string;
  perf?: Perf;
}): PerfAssessmentView {
  const rating = input.perf?.rating ?? "";
  return {
    layer: "assessment",
    date: input.date,
    employeeId: input.employeeId,
    rating,
    ratingLabel: rating ? RATING_LABEL[rating] : "Not assessed",
  };
}

/** Assert layers stay distinct — facts never become ratings. */
export function assertLayersDistinct(facts: PerfFact[], assessment: PerfAssessmentView): boolean {
  // Facts never carry a rating; assessment never invents fact kinds.
  return facts.every((f) => f.layer === "fact") && assessment.layer === "assessment";
}

type State = {
  followUps: PerfFollowUp[];
  hrStatements: HrStatement[];
  addFollowUp: (input: {
    employeeId: string;
    employeeName: string;
    due: string;
    title: string;
    linkedDate?: string;
    note?: string;
  }) => PerfFollowUp | { error: string };
  completeFollowUp: (id: string) => void;
  reopenFollowUp: (id: string) => void;
  removeFollowUp: (id: string) => void;
  addHrStatement: (employeeId: string, date: string, text: string) => HrStatement | { error: string };
  openFollowUps: (date?: string) => PerfFollowUp[];
};

export const usePerfFollowUps = create<State>()(
  persist(
    (set, get) => ({
      followUps: [],
      hrStatements: [],
      addFollowUp: (input) => {
        const title = input.title.trim();
        if (!title) return { error: "Title required" };
        if (!input.employeeId) return { error: "Employee required" };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return { error: "Due date required" };
        const row: PerfFollowUp = {
          id: uid(),
          employeeId: input.employeeId,
          employeeName: input.employeeName,
          due: input.due,
          title,
          status: "open",
          linkedDate: input.linkedDate ?? "",
          note: (input.note ?? "").trim(),
          createdAt: Date.now(),
          completedAt: null,
        };
        set({ followUps: [row, ...get().followUps] });
        return row;
      },
      completeFollowUp: (id) =>
        set((s) => ({
          followUps: s.followUps.map((f) =>
            f.id === id ? { ...f, status: "done", completedAt: Date.now() } : f,
          ),
        })),
      reopenFollowUp: (id) =>
        set((s) => ({
          followUps: s.followUps.map((f) =>
            f.id === id ? { ...f, status: "open", completedAt: null } : f,
          ),
        })),
      removeFollowUp: (id) => set((s) => ({ followUps: s.followUps.filter((f) => f.id !== id) })),
      addHrStatement: (employeeId, date, text) => {
        const t = text.trim();
        if (!t) return { error: "Statement text required" };
        if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Employee and date required" };
        const row: HrStatement = { id: uid(), employeeId, date, text: t, createdAt: Date.now() };
        set({ hrStatements: [row, ...get().hrStatements].slice(0, 500) });
        return row;
      },
      openFollowUps: (date) => {
        const open = get().followUps.filter((f) => f.status === "open");
        if (!date) return open;
        return open.filter((f) => f.due <= date);
      },
    }),
    { name: PERF_FOLLOWUPS_STORAGE_KEY },
  ),
);
