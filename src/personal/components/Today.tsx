import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Flame,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Timer,
} from "lucide-react";
import { AlertStrip } from "./AlertStrip";
import { Btn, Panel, SectionHead, Stat } from "./common";
import {
  consistencyDays,
  streakDays,
  studyMinutesInRange,
  todayKey,
  usePersonal,
} from "@/personal/lib/store";
import {
  BUSY_MINUTES,
  RESCUE_MINUTES,
  isSundayIso,
  modeBudgetMinutes,
  modeLabel,
} from "@/personal/lib/schedule";
import {
  VU_STUDY_PLAN,
  buildTodayPrescription,
  courseIdFromCode,
  formatMinutes,
  type TodayBlock,
} from "@/personal/lib/vu-plan";
import {
  VU_DAILY_HABIT,
  VU_FOCUS_MODES,
  VU_LESSON_RHYTHM,
  VU_TIMER_PRESETS,
  ocwHomeUrl,
  rhythmLabelForBlockKind,
  vulmsHomeUrl,
  youtubeSearchUrl,
} from "@/personal/lib/vu-rhythm";

type TimerState = {
  blockId: string | null;
  running: boolean;
  remainingSec: number;
  startedAt: number | null;
  accumulatedMs: number;
  showRecall: boolean;
};

const DONE_KEY = "hr-personal-vu-today-done-v1";
const MODE_KEY = "hr-personal-vu-today-modes-v1";

function loadDoneMap(date: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return parsed[date] ?? {};
  } catch {
    return {};
  }
}

function saveDoneMap(date: string, map: Record<string, boolean>) {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {};
    parsed[date] = map;
    localStorage.setItem(DONE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

function loadModes(): { handoutFirst: boolean; creditTriage: boolean } {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (!raw) return { handoutFirst: true, creditTriage: false };
    return JSON.parse(raw) as { handoutFirst: boolean; creditTriage: boolean };
  } catch {
    return { handoutFirst: true, creditTriage: false };
  }
}

export function Today() {
  const settings = usePersonal((s) => s.settings);
  const courses = usePersonal((s) => s.courses);
  const sessions = usePersonal((s) => s.sessions);
  const assessments = usePersonal((s) => s.assessments);
  const dayPlans = usePersonal((s) => s.dayPlans);
  const vuSeededAt = usePersonal((s) => s.vuSeededAt);
  const vuPlanAsOf = usePersonal((s) => s.vuPlanAsOf);
  const ensureDayPlan = usePersonal((s) => s.ensureDayPlan);
  const setDayMode = usePersonal((s) => s.setDayMode);
  const importVuStudyPlan = usePersonal((s) => s.importVuStudyPlan);
  const addSession = usePersonal((s) => s.addSession);
  const toggleAssessment = usePersonal((s) => s.toggleAssessment);
  const toggleBacklog = usePersonal((s) => s.toggleBacklog);
  const backlog = usePersonal((s) => s.backlog);

  const today = todayKey();
  const sunday = isSundayIso(today);
  const student = VU_STUDY_PLAN.student;
  const [modes, setModes] = useState(loadModes);
  const rx = useMemo(
    () =>
      buildTodayPrescription(VU_STUDY_PLAN, today, {
        handoutFirst: modes.handoutFirst,
        creditHourTriage: modes.creditTriage,
      }),
    [today, modes.handoutFirst, modes.creditTriage],
  );

  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(() => loadDoneMap(today));
  const [presetId, setPresetId] = useState("lecture");
  const [focusMode, setFocusMode] = useState<"block" | "pomodoro" | "deep">("block");
  const [timer, setTimer] = useState<TimerState>({
    blockId: null,
    running: false,
    remainingSec: 0,
    startedAt: null,
    accumulatedMs: 0,
    showRecall: false,
  });
  const tickRef = useRef<number | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    ensureDayPlan(today);
  }, [ensureDayPlan, today]);

  useEffect(() => {
    setDoneMap(loadDoneMap(today));
  }, [today]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, JSON.stringify(modes));
  }, [modes]);

  useEffect(() => {
    if (!timer.running) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    tickRef.current = window.setInterval(() => {
      setTimer((t) => {
        if (t.remainingSec <= 1) {
          return {
            ...t,
            remainingSec: 0,
            running: false,
            startedAt: null,
            showRecall: true,
          };
        }
        return { ...t, remainingSec: t.remainingSec - 1 };
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [timer.running]);

  useEffect(() => {
    if (!vuSeededAt) importVuStudyPlan();
  }, [vuSeededAt, importVuStudyPlan]);

  const plan = dayPlans[today];
  const minutes7d = studyMinutesInRange(sessions, Date.now() - 7 * 86400000, Date.now());
  const streak = streakDays(sessions);
  const active14 = consistencyDays(sessions, 14);
  const doneCount = Object.values(doneMap).filter(Boolean).length;
  const progressPct = rx.blocks.length
    ? Math.round((doneCount / rx.blocks.length) * 100)
    : 0;

  const progressCourses = VU_STUDY_PLAN.enrolledCourses.map((c) => {
    const p = VU_STUDY_PLAN.progressTimeline.courses[
      c.code as keyof typeof VU_STUDY_PLAN.progressTimeline.courses
    ] as { dataLoaded?: boolean; attendance?: { presentPct?: number | null; absentPct?: number | null } | null; quizSummary?: { submitted?: number | null; totalQuizzes?: number | null } | null } | undefined;
    return { code: c.code, title: c.title, progress: p };
  });

  const markDone = (block: TodayBlock, done: boolean) => {
    const next = { ...doneMap, [block.id]: done };
    setDoneMap(next);
    saveDoneMap(today, next);
    if (block.todoTitle) {
      const a = assessments.find((x) => x.title === block.todoTitle);
      if (a && a.done !== done) toggleAssessment(a.id);
      const b = backlog.find((x) => x.label.includes(block.todoTitle || ""));
      if (b && b.done !== done) toggleBacklog(b.id);
    }
  };

  const resolveMinutes = (block: TodayBlock) => {
    if (focusMode === "pomodoro") return VU_FOCUS_MODES.find((m) => m.name === "pomodoro")?.workMinutes ?? 25;
    if (focusMode === "deep") return VU_FOCUS_MODES.find((m) => m.name === "deep")?.workMinutes ?? 50;
    const preset = VU_TIMER_PRESETS.find((p) => p.id === presetId);
    return preset?.minutes ?? block.minutes;
  };

  const flushTimerSession = () => {
    const t = timerRef.current;
    if (!t.blockId) return;
    const block = rx.blocks.find((b) => b.id === t.blockId);
    if (!block) return;
    let ms = t.accumulatedMs;
    if (t.startedAt) ms += Date.now() - t.startedAt;
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 1) return;
    addSession({
      courseId: courseIdFromCode(block.courseCode),
      startedAt: Date.now() - ms,
      endedAt: Date.now(),
      minutes,
      mode: plan?.mode ?? "normal",
      label: block.label,
    });
  };

  const startTimer = (block: TodayBlock) => {
    flushTimerSession();
    setTimer({
      blockId: block.id,
      running: true,
      remainingSec: Math.max(60, resolveMinutes(block) * 60),
      startedAt: Date.now(),
      accumulatedMs: 0,
      showRecall: false,
    });
  };

  const pauseTimer = () => {
    setTimer((t) => {
      if (!t.running || !t.startedAt) return { ...t, running: false };
      return {
        ...t,
        running: false,
        accumulatedMs: t.accumulatedMs + (Date.now() - t.startedAt),
        startedAt: null,
      };
    });
  };

  const resumeTimer = () => {
    setTimer((t) => ({ ...t, running: true, startedAt: Date.now(), showRecall: false }));
  };

  const completeWithTimer = (block: TodayBlock) => {
    if (timer.blockId === block.id) {
      flushTimerSession();
      setTimer({
        blockId: null,
        running: false,
        remainingSec: 0,
        startedAt: null,
        accumulatedMs: 0,
        showRecall: true,
      });
    }
    markDone(block, true);
  };

  const modeChips: { id: "normal" | "busy" | "rescue"; label: string; mins: number }[] = [
    {
      id: "normal",
      label: sunday ? "Sunday Recovery" : "Today target",
      mins: sunday ? settings.sundayMinutes : settings.weekdayMinutes,
    },
    { id: "busy", label: "Busy", mins: BUSY_MINUTES },
    { id: "rescue", label: "Rescue", mins: RESCUE_MINUTES },
  ];

  const activeBlock = rx.blocks.find((b) => b.id === timer.blockId) ?? null;
  const mm = String(Math.floor(timer.remainingSec / 60)).padStart(2, "0");
  const ss = String(timer.remainingSec % 60).padStart(2, "0");
  const next = rx.nextIrreversible;

  return (
    <div className="space-y-4">
      <AlertStrip />

      <section className="hp-today-hero hp-fade-up relative overflow-hidden rounded-2xl border border-[var(--hp-border)] p-4 sm:p-6">
        <div className="hp-today-orb" aria-hidden />
        <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--hp-violet-soft)]">
              Today · {student.name} · {student.studentId} · e-ID to {student.eCardValidUntil}
            </div>
            <h2 className="hp-title mt-2 text-3xl font-bold tracking-tight text-[var(--hp-ink)] sm:text-4xl">
              {formatMinutes(rx.dailyTotal)} · graded windows first
            </h2>
            {next ? (
              <p className="mt-2 text-sm font-semibold text-[var(--hp-amber)]">
                Next irreversible To-Do Calendar item: {next.title}
                {next.due ? ` · locks ${next.due}` : ""} · verify status on VULMS
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-[var(--hp-muted)]">{rx.motivation}</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--hp-muted)]">{rx.howBehind}</p>
            <p className="mt-3 text-[11px] font-semibold text-[var(--hp-teal)]">{VU_DAILY_HABIT}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-xl border border-[var(--hp-border)] bg-[color-mix(in_srgb,var(--hp-elevated)_80%,transparent)] px-4 py-3 text-right backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hp-muted)]">
                Export as-of
              </div>
              <div className="hp-title text-lg font-bold tabular-nums">
                {vuPlanAsOf || VU_STUDY_PLAN.asOf}
              </div>
              <div className="text-[11px] text-[var(--hp-muted)]">
                Grade Book marks: none recorded
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <a className="hp-btn-primary !no-underline" href={vulmsHomeUrl()} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open VULMS
              </a>
              <Btn variant="ghost" onClick={() => importVuStudyPlan()}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-import exports
              </Btn>
            </div>
          </div>
        </div>

        <div className="relative z-[1] mt-4 flex flex-wrap gap-2">
          <Btn
            variant={modes.handoutFirst ? "teal" : "ghost"}
            onClick={() => setModes((m) => ({ ...m, handoutFirst: !m.handoutFirst }))}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Handout-first catch-up {modes.handoutFirst ? "ON" : "OFF"}
          </Btn>
          <Btn
            variant={modes.creditTriage ? "primary" : "ghost"}
            onClick={() => setModes((m) => ({ ...m, creditTriage: !m.creditTriage }))}
          >
            Credit-hour triage {modes.creditTriage ? "ON" : "OFF"}
          </Btn>
        </div>

        <div className="relative z-[1] mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Today load" value={formatMinutes(rx.dailyTotal)} hint={rx.math} accent="violet" />
          <Stat
            label="To-Do pendency"
            value={String(rx.pendencyCount)}
            hint={`${rx.openRecoverableCount} open · ${rx.overdueCount} ended/unverified`}
            accent="amber"
          />
          <Stat
            label="Logged streak"
            value={`${streak}d`}
            hint={`${active14} active / 14d · ${minutes7d}m (7d) — real Focus only`}
            accent="teal"
          />
          <Stat
            label="Verified blocks"
            value={`${progressPct}%`}
            hint={`${doneCount}/${rx.blocks.length} marked done today`}
            accent="blue"
          />
        </div>
        <div className="relative z-[1] mt-4 h-2 overflow-hidden rounded-full bg-[var(--hp-border)]">
          <div
            className="hp-progress-fill h-full rounded-full bg-gradient-to-r from-[var(--hp-violet)] via-[var(--hp-blue)] to-[var(--hp-teal)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Panel className="hp-fade-up-delay">
          <SectionHead
            title="Daily schedule"
            subtitle="Order: To-Do Calendar graded → Handout prep → Lecture Schedule → Progress Timeline backlog"
            action={
              <div className="flex flex-wrap gap-1">
                {modeChips.map((m) => (
                  <Btn
                    key={m.id}
                    variant={plan?.mode === m.id ? "primary" : "ghost"}
                    onClick={() => setDayMode(today, m.id)}
                  >
                    {m.label} {m.mins}m
                  </Btn>
                ))}
              </div>
            }
          />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--hp-muted)]">
              Timer presets (estimates)
            </span>
            {VU_TIMER_PRESETS.map((p) => (
              <Btn
                key={p.id}
                variant={presetId === p.id && focusMode === "block" ? "primary" : "ghost"}
                className="!py-1"
                onClick={() => {
                  setFocusMode("block");
                  setPresetId(p.id);
                }}
              >
                {p.id === "gdb" ? "GDB" : p.id} {p.minutes}m
              </Btn>
            ))}
            <Btn
              variant={focusMode === "pomodoro" ? "teal" : "ghost"}
              className="!py-1"
              onClick={() => setFocusMode("pomodoro")}
            >
              Pomodoro 25/5
            </Btn>
            <Btn
              variant={focusMode === "deep" ? "teal" : "ghost"}
              className="!py-1"
              onClick={() => setFocusMode("deep")}
            >
              Deep 50/10
            </Btn>
          </div>

          <p className="mb-3 text-xs text-[var(--hp-muted)]">
            Capacity {plan ? modeBudgetMinutes(plan.mode, today, settings) : "—"}m ·{" "}
            {plan ? modeLabel(plan.mode, today) : "Preparing"} — Busy/Rescue on hard days; never invent
            Grade Book marks.
          </p>

          <ul className="space-y-2.5">
            {rx.blocks.map((b, i) => {
              const done = !!doneMap[b.id];
              const active = timer.blockId === b.id;
              return (
                <li
                  key={b.id}
                  className={`hp-schedule-row rounded-xl border px-3 py-3 transition ${
                    done
                      ? "border-[var(--hp-teal)]/35 bg-[color-mix(in_srgb,var(--hp-teal)_8%,transparent)] opacity-80"
                      : active
                        ? "border-[var(--hp-violet)] bg-[color-mix(in_srgb,var(--hp-violet)_12%,transparent)]"
                        : "border-[var(--hp-border)] bg-[var(--hp-elevated)] hover:border-[var(--hp-violet)]/40"
                  }`}
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="hp-title text-sm font-bold tabular-nums text-[var(--hp-violet)]">
                          {b.clock || "Flex"}
                        </span>
                        <span className="rounded bg-[var(--hp-blue)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--hp-blue-bright)]">
                          {rhythmLabelForBlockKind(b.kind, modes.handoutFirst)}
                        </span>
                        {b.due ? (
                          <span className="text-[10px] font-semibold text-[var(--hp-amber)]">
                            due {b.due}
                          </span>
                        ) : null}
                        {b.room ? (
                          <span className="text-[10px] font-semibold text-[var(--hp-muted)]">{b.room}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--hp-ink)]">{b.label}</div>
                      <div className="text-xs text-[var(--hp-muted)]">
                        {b.courseCode} · {b.minutes}m suggested
                        {courses.find((c) => c.code === b.courseCode)?.requirementType
                          ? ` · ${courses.find((c) => c.code === b.courseCode)?.requirementType}`
                          : ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                        <a
                          className="font-semibold text-[var(--hp-teal)] underline-offset-2 hover:underline"
                          href={vulmsHomeUrl()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open VULMS course
                        </a>
                        <a
                          className="font-semibold text-[var(--hp-blue-bright)] underline-offset-2 hover:underline"
                          href={youtubeSearchUrl(b.courseCode)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Search YouTube by {b.courseCode}
                        </a>
                        <a
                          className="font-semibold text-[var(--hp-muted)] underline-offset-2 hover:underline"
                          href={ocwHomeUrl()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          OCW
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!done ? (
                        <>
                          {!active || !timer.running ? (
                            <Btn
                              variant="primary"
                              className="!py-1.5"
                              onClick={() => (active ? resumeTimer() : startTimer(b))}
                            >
                              <Play className="h-3.5 w-3.5" />
                              {active ? "Resume" : "Start"}
                            </Btn>
                          ) : (
                            <Btn variant="ghost" className="!py-1.5" onClick={pauseTimer}>
                              <Pause className="h-3.5 w-3.5" /> Pause
                            </Btn>
                          )}
                          <Btn variant="teal" className="!py-1.5" onClick={() => completeWithTimer(b)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Done
                          </Btn>
                        </>
                      ) : (
                        <Btn variant="ghost" className="!py-1.5" onClick={() => markDone(b, false)}>
                          Undo
                        </Btn>
                      )}
                    </div>
                  </div>
                  {active ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--hp-violet)]/30 bg-[color-mix(in_srgb,var(--hp-violet)_8%,transparent)] px-3 py-2">
                      <Timer className="h-4 w-4 text-[var(--hp-violet)]" />
                      <span className="hp-title text-2xl font-bold tabular-nums tracking-tight">
                        {mm}:{ss}
                      </span>
                      <span className="text-xs text-[var(--hp-muted)]">
                        {timer.running ? "Running" : "Paused"} · {focusMode} timer
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {timer.showRecall ? (
            <div className="mt-3 rounded-xl border border-[var(--hp-teal)]/30 bg-[color-mix(in_srgb,var(--hp-teal)_10%,transparent)] px-3 py-3 text-sm">
              <strong className="text-[var(--hp-ink)]">2-minute recall:</strong>{" "}
              <span className="text-[var(--hp-muted)]">
                Close notes. Say one question you can now answer from that Handout / Lecture / Quiz
                prep block. Then continue.
              </span>
              <div className="mt-2">
                <Btn variant="ghost" className="!py-1" onClick={() => setTimer((t) => ({ ...t, showRecall: false }))}>
                  Got it
                </Btn>
              </div>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-4">
          <Panel className="hp-fade-up-delay">
            <SectionHead
              title="VU lesson rhythm"
              subtitle="Public pattern — your remaining work still comes only from exports"
            />
            <ol className="space-y-2">
              {VU_LESSON_RHYTHM.map((step, i) => (
                <li key={step.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--hp-violet)]/20 text-[11px] font-bold text-[var(--hp-violet)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--hp-ink)]">{step.title}</div>
                    <div className="text-xs leading-relaxed text-[var(--hp-muted)]">{step.blurb}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel>
            <SectionHead
              title="Progress Timeline"
              subtitle="Per-course cards — empty until that tab is exported"
            />
            <div className="space-y-2">
              {progressCourses.map(({ code, title, progress }) => (
                <div
                  key={code}
                  className="rounded-lg border border-[var(--hp-border)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[var(--hp-ink)]">
                      {code}{" "}
                      <span className="font-semibold text-[var(--hp-muted)]">· {title}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        progress?.dataLoaded ? "text-[var(--hp-teal)]" : "text-[var(--hp-muted)]"
                      }`}
                    >
                      {progress?.dataLoaded ? "Loaded" : "Export needed"}
                    </span>
                  </div>
                  {progress?.dataLoaded ? (
                    <p className="mt-1 text-[11px] text-[var(--hp-muted)]">
                      Attendance Present {progress.attendance?.presentPct ?? "?"}% / Absent{" "}
                      {progress.attendance?.absentPct ?? "?"}%
                      {progress.quizSummary?.totalQuizzes != null
                        ? ` · Quizzes submitted ${progress.quizSummary.submitted ?? 0}/${progress.quizSummary.totalQuizzes}`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-[var(--hp-muted)]">
                      Export Progress Timeline for {code} (open the course tab, wait for charts, save).
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHead title="Course tracker" subtitle="Required vs Elective from Study Scheme" />
            <div className="space-y-2">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--hp-border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[var(--hp-ink)]">
                      {c.code}{" "}
                      <span className="font-semibold text-[var(--hp-muted)]">· {c.title}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      c.requirementType === "Elective"
                        ? "bg-[var(--hp-teal)]/15 text-[var(--hp-teal)]"
                        : "bg-[var(--hp-violet)]/15 text-[var(--hp-violet)]"
                    }`}
                  >
                    {c.requirementType || "—"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="hp-motivate flex items-start gap-2 rounded-xl border border-[var(--hp-teal)]/25 bg-[color-mix(in_srgb,var(--hp-teal)_8%,transparent)] px-3 py-3 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--hp-teal)]" />
            <div>
              <div className="font-semibold text-[var(--hp-ink)]">You can recover</div>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--hp-muted)]">
                {rx.openRecoverableCount > 0 ? (
                  <>
                    {rx.openRecoverableCount} open graded window(s) are still recoverable marks on
                    the table — Start the top To-Do Calendar block.
                  </>
                ) : activeBlock ? (
                  <>
                    Focus now: <strong className="text-[var(--hp-ink)]">{activeBlock.label}</strong>.
                  </>
                ) : streak > 0 ? (
                  <>
                    <Flame className="mr-1 inline h-3.5 w-3.5 text-[var(--hp-amber)]" />
                    {streak}-day logged streak — protect it with the next verified block.
                  </>
                ) : (
                  <>Hit Start. Logged minutes beat perfect plans.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
