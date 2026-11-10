/** Helpers over the VU export fixture — never invent marks or lecture completion. */

import planFixture from "@/personal/data/vu-study-plan.json";

export type VuTodoKind = "assignment" | "quiz" | "gdb" | "fee" | "other";
export type VuTodoStatus = "open_now" | "window_ended" | "upcoming" | "unknown";

export type VuTodo = {
  title: string;
  courseCode: string | null;
  kind: VuTodoKind;
  start: string | null;
  due: string | null;
  urlPath?: string | null;
  isExpiredFlag: boolean;
  statusAsOf: VuTodoStatus;
  semester?: string | null;
};

export type VuLectureSlot = {
  date: string | null;
  weekday: string | null;
  time: string;
  courseCode: string;
  lectureNumber: number;
  room: string | null;
  raw?: string;
};

export type VuStudyPlan = typeof planFixture;

export const VU_STUDY_PLAN = planFixture as VuStudyPlan;

export function courseIdFromCode(code: string): string {
  return code.trim().toLowerCase();
}

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${String(rem).padStart(2, "0")}m`;
}

export function isoTodayLocal(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Recompute open/ended/upcoming relative to a live calendar day. */
export function liveTodoStatus(todo: VuTodo, todayIso: string): VuTodoStatus {
  if (todo.kind === "fee" || !todo.due) return todo.statusAsOf;
  const due = todo.due;
  const start = todo.start;
  if (due < todayIso) return "window_ended";
  if (start && start <= todayIso && due >= todayIso) return "open_now";
  if (start && start > todayIso) return "upcoming";
  if (due >= todayIso) return "open_now";
  return "unknown";
}

export function academicTodos(plan: VuStudyPlan = VU_STUDY_PLAN): VuTodo[] {
  return (plan.todos as VuTodo[]).filter((t) => t.kind !== "fee" && t.courseCode);
}

export function feeTodos(plan: VuStudyPlan = VU_STUDY_PLAN): VuTodo[] {
  return (plan.todos as VuTodo[]).filter((t) => t.kind === "fee");
}

export function pendencyTodos(plan: VuStudyPlan, todayIso: string): VuTodo[] {
  return academicTodos(plan)
    .map((t) => ({ ...t, statusAsOf: liveTodoStatus(t, todayIso) }))
    .filter((t) => t.statusAsOf === "open_now" || t.statusAsOf === "window_ended")
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
}

export function dueSoonTodos(plan: VuStudyPlan, todayIso: string, withinDays = 7): VuTodo[] {
  const end = addDaysIso(todayIso, withinDays);
  return academicTodos(plan)
    .map((t) => ({ ...t, statusAsOf: liveTodoStatus(t, todayIso) }))
    .filter((t) => t.due && t.due >= todayIso && t.due <= end)
    .sort((a, b) => (a.due || "").localeCompare(b.due || ""));
}

export function overdueTodos(plan: VuStudyPlan, todayIso: string): VuTodo[] {
  return academicTodos(plan)
    .map((t) => ({ ...t, statusAsOf: liveTodoStatus(t, todayIso) }))
    .filter((t) => t.statusAsOf === "window_ended")
    .sort((a, b) => (a.due || "").localeCompare(b.due || ""));
}

export function slotsForDate(plan: VuStudyPlan, dateIso: string): VuLectureSlot[] {
  return (plan.weeklyLectureSchedule.slots as VuLectureSlot[])
    .filter((s) => s.date === dateIso)
    .slice()
    .sort((a, b) => parseVuTime(a.time) - parseVuTime(b.time));
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoTodayLocal(d);
}

export function parseVuTime(label: string): number {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export function minutesToClock(mins: number): string {
  const h24 = ((Math.floor(mins / 60) % 24) + 24) % 24;
  const m = ((mins % 60) + 60) % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export type TodayBlock = {
  id: string;
  kind: "lecture" | "recovery" | "cs101_catchup" | "handout" | "prep";
  courseCode: string;
  label: string;
  minutes: number;
  clock: string | null;
  room: string | null;
  todoTitle?: string;
  /** Lower sorts first — deep research §8 todayPlanOrder */
  priority: number;
  due?: string | null;
};

export type PrescriptionOpts = {
  handoutFirst?: boolean;
  creditHourTriage?: boolean;
};

function closingScore(todo: VuTodo, todayIso: string): number {
  if (todo.statusAsOf === "window_ended") return -1000;
  if (!todo.due) return 5000;
  return (
    (new Date(`${todo.due}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime()) /
    86400000
  );
}

function activityNoun(t: VuTodo): string {
  if (t.kind === "assignment") return "Assignment";
  if (/gdb/i.test(t.title)) return "GDB";
  if (t.kind === "quiz") return "Quiz";
  return "Activity";
}

/**
 * Today plan engine (§8): graded closing soon → handout prep → Lecture Schedule → Progress backlog.
 * Remaining minutes/counts come only from exports + explicit planning assumptions.
 */
export function buildTodayPrescription(
  plan: VuStudyPlan,
  todayIso: string,
  opts: PrescriptionOpts = {},
): {
  dailyTotal: number;
  recoveryPortion: number;
  keepUpPortion: number;
  cs101Portion: number;
  math: string;
  blocks: TodayBlock[];
  motivation: string;
  howBehind: string;
  pendencyCount: number;
  overdueCount: number;
  openRecoverableCount: number;
  nextIrreversible: VuTodo | null;
} {
  const handoutFirst = !!opts.handoutFirst;
  const assumptions = plan.recovery.assumptions as {
    assignmentMinutes: number;
    quizMinutes: number;
    lectureMinutes: number;
    recoveryDays: number;
    keepUpDaysPerWeek: number;
  };
  const pending = pendencyTodos(plan, todayIso);
  const overdue = pending.filter((t) => t.statusAsOf === "window_ended");
  const openNow = pending.filter((t) => t.statusAsOf === "open_now");
  const slots = slotsForDate(plan, todayIso);
  const weekSlots = plan.weeklyLectureSchedule.slots as VuLectureSlot[];
  const catchUp = plan.recovery.cs101ProgressCatchUp as {
    absentWeeksVisible: number;
    estimatedCatchUpMinutes: number;
    attendanceAbsentPct?: number | null;
  };
  const creditByCode = new Map(
    plan.enrolledCourses.map((c) => [c.code, c.creditHours ?? 0] as const),
  );

  let pendencyMinutes = 0;
  for (const t of pending) {
    pendencyMinutes += t.kind === "assignment" ? assumptions.assignmentMinutes : assumptions.quizMinutes;
  }
  const recoveryPortion = Math.round(pendencyMinutes / assumptions.recoveryDays);
  const lectureUnit = handoutFirst ? 20 : assumptions.lectureMinutes;
  const keepUpPortion = Math.round((weekSlots.length * lectureUnit) / assumptions.keepUpDaysPerWeek);
  const cs101Raw = catchUp?.estimatedCatchUpMinutes ?? 0;
  const cs101Adjusted = handoutFirst ? Math.round(cs101Raw * (20 / 50)) : cs101Raw;
  const cs101Portion = Math.round(cs101Adjusted / assumptions.recoveryDays);
  const dailyTotal = recoveryPortion + keepUpPortion + cs101Portion;
  const math =
    `To-Do Calendar pendency ${pendencyMinutes}m / ${assumptions.recoveryDays}d = ${recoveryPortion}m + ` +
    `Lecture Schedule keep-up (${weekSlots.length}×${lectureUnit}m${handoutFirst ? " handout-first" : ""})/${assumptions.keepUpDaysPerWeek} = ${keepUpPortion}m + ` +
    `CS101 Progress Timeline catch-up ${cs101Adjusted}m / ${assumptions.recoveryDays}d = ${cs101Portion}m → ${dailyTotal}m/day`;

  const blocks: TodayBlock[] = [];
  const gradedOrdered = [...pending].sort((a, b) => {
    const sa = closingScore(a, todayIso);
    const sb = closingScore(b, todayIso);
    if (sa !== sb) return sa - sb;
    if (opts.creditHourTriage) {
      return (creditByCode.get(b.courseCode || "") || 0) - (creditByCode.get(a.courseCode || "") || 0);
    }
    return (a.title || "").localeCompare(b.title || "");
  });

  let recoveryLeft = Math.max(recoveryPortion, gradedOrdered.length ? 45 : 0);
  let cursor = 9 * 60;
  let prepCount = 0;
  for (const t of gradedOrdered) {
    if (recoveryLeft <= 0) break;
    const need =
      t.kind === "assignment" ? assumptions.assignmentMinutes : assumptions.quizMinutes;
    const slice = Math.min(need, recoveryLeft, 55);
    const noun = activityNoun(t);
    blocks.push({
      id: `rec-${t.courseCode}-${t.title}`,
      kind: "recovery",
      courseCode: t.courseCode || "GEN",
      label:
        t.statusAsOf === "window_ended"
          ? `Verify on VULMS · ${noun} · ${t.title}`
          : `Attempt / submit · ${noun} · ${t.title}`,
      minutes: slice,
      clock: minutesToClock(cursor),
      room: null,
      todoTitle: t.title,
      priority: 0,
      due: t.due,
    });
    if (prepCount < 3) {
      blocks.push({
        id: `prep-${t.courseCode}-${t.title}`,
        kind: "prep",
        courseCode: t.courseCode || "GEN",
        label: `Handout prep for ${t.courseCode} · ${noun}`,
        minutes: 20,
        clock: minutesToClock(cursor + slice + 5),
        room: null,
        todoTitle: t.title,
        priority: 1,
        due: t.due,
      });
      prepCount += 1;
    }
    recoveryLeft -= slice;
    cursor += slice + 30;
  }

  for (const s of slots) {
    blocks.push({
      id: `lec-${s.courseCode}-${s.lectureNumber}-${s.time}`,
      kind: handoutFirst ? "handout" : "lecture",
      courseCode: s.courseCode,
      label: handoutFirst
        ? `${s.courseCode} · Handout for Lec ${s.lectureNumber}`
        : `${s.courseCode} · Lec ${s.lectureNumber}`,
      minutes: lectureUnit,
      clock: s.time,
      room: s.room,
      priority: 2,
    });
  }

  if (cs101Portion > 0) {
    blocks.push({
      id: "cs101-progress-catchup",
      kind: "cs101_catchup",
      courseCode: "CS101",
      label: handoutFirst
        ? `CS101 Handouts catch-up · Progress Timeline ${catchUp.absentWeeksVisible} absent weeks`
        : `CS101 Progress Timeline catch-up · ${catchUp.absentWeeksVisible} absent weeks`,
      minutes: cs101Portion,
      clock: minutesToClock(Math.max(cursor, 19 * 60)),
      room: null,
      priority: 3,
    });
  }

  blocks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.priority <= 1 && b.priority <= 1) {
      const ad = a.due || "";
      const bd = b.due || "";
      if (ad !== bd) return ad.localeCompare(bd);
      if (a.kind !== b.kind) return a.kind === "recovery" ? -1 : 1;
    }
    const am = a.clock ? parseVuTime(a.clock) : 9999;
    const bm = b.clock ? parseVuTime(b.clock) : 9999;
    return am - bm;
  });

  const nextIrreversible =
    [...openNow].sort((a, b) => closingScore(a, todayIso) - closingScore(b, todayIso))[0] ||
    overdue[0] ||
    null;

  const daysBehind = plan.recovery.estimatedDaysBehindByOldestEndedWindow as number | null;
  const howBehind =
    `CS101 Progress Timeline: ${catchUp?.absentWeeksVisible ?? "?"} absent weeks` +
    (catchUp?.attendanceAbsentPct != null ? ` · ${catchUp.attendanceAbsentPct}% absent` : "") +
    (daysBehind != null
      ? ` · oldest ended To-Do Calendar window ~${daysBehind}d before export as-of`
      : "") +
    ` · ${pending.length} graded windows to verify/clear. Other courses’ Progress Timeline: unknown until re-exported.`;

  const motivation =
    openNow.length > 0
      ? `${openNow.length} recoverable graded window(s) still open on the To-Do Calendar — clear those before bingeing the full lecture backlog.`
      : overdue.length > 0
        ? "Some To-Do Calendar windows already ended — verify on VULMS, then protect what’s still open next."
        : "Quiet graded queue — keep Handouts + Lecture Schedule rhythm and log real Focus time.";

  return {
    dailyTotal,
    recoveryPortion,
    keepUpPortion,
    cs101Portion,
    math,
    blocks,
    motivation,
    howBehind,
    pendencyCount: pending.length,
    overdueCount: overdue.length,
    openRecoverableCount: openNow.length,
    nextIrreversible,
  };
}
