import { useEffect, useRef, useState } from "react";
import { Btn, Field, Panel, SectionHead } from "./common";
import { usePersonal } from "@/personal/lib/store";
import type { FocusActivityKind, StudyMode } from "@/personal/lib/types";
import { VU_FOCUS_MODES, VU_TIMER_PRESETS } from "@/personal/lib/vu-rhythm";

type Phase = "focus" | "break" | "idle";
type TimerProfile = "preset" | "pomodoro" | "deep";

const ACTIVITY_LABELS: Record<FocusActivityKind, string> = {
  lecture: "Lecture",
  handout: "Handout",
  gdb: "GDB",
  quizPrep: "Quiz prep",
  assignment: "Assignment",
  break: "Break",
  revision: "Revision",
  practice: "Practice",
  other: "Other",
};

function presetToActivity(id: string): FocusActivityKind {
  if (id === "lecture" || id === "handout" || id === "gdb" || id === "quizPrep" || id === "assignment" || id === "break") {
    return id;
  }
  return "other";
}

export function Focus() {
  const courses = usePersonal((s) => s.courses);
  const settings = usePersonal((s) => s.settings);
  const addSession = usePersonal((s) => s.addSession);
  const sessions = usePersonal((s) => s.sessions);
  const toggleDiscipline = usePersonal((s) => s.toggleDiscipline);

  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "cs101");
  const [mode, setMode] = useState<StudyMode>("normal");
  const [profile, setProfile] = useState<TimerProfile>("pomodoro");
  const [presetId, setPresetId] = useState(VU_TIMER_PRESETS[0]?.id ?? "lecture");
  const [activityKind, setActivityKind] = useState<FocusActivityKind>("lecture");
  const [lessonLabel, setLessonLabel] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(settings.pomodoroFocus * 60);
  const [running, setRunning] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const startedAt = useRef<number | null>(null);
  const focusAccum = useRef(0);

  const focusMinutes = () => {
    if (profile === "deep") return settings.deepFocus || VU_FOCUS_MODES.find((m) => m.name === "deep")?.workMinutes || 50;
    if (profile === "pomodoro")
      return settings.pomodoroFocus || VU_FOCUS_MODES.find((m) => m.name === "pomodoro")?.workMinutes || 25;
    return VU_TIMER_PRESETS.find((p) => p.id === presetId)?.minutes ?? 25;
  };

  const breakMinutes = () => {
    if (profile === "deep") return settings.deepBreak || 10;
    return settings.pomodoroBreak || 5;
  };

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          setRunning(false);
          if (phase === "focus" && startedAt.current) {
            const ended = Date.now();
            const minutes = Math.max(
              1,
              Math.round((ended - startedAt.current + focusAccum.current) / 60000),
            );
            addSession({
              courseId,
              startedAt: startedAt.current,
              endedAt: ended,
              minutes,
              mode,
              label: lessonLabel.trim() || ACTIVITY_LABELS[activityKind],
              activityKind,
              ...(lessonLabel.trim() ? { lessonLabel: lessonLabel.trim() } : {}),
            });
            focusAccum.current = 0;
            startedAt.current = null;
            setShowRecall(activityKind !== "break");
            setPhase("break");
            setLeft(breakMinutes() * 60);
          } else {
            setPhase("idle");
            setLeft(focusMinutes() * 60);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer tick uses latest refs/state via closures refreshed on running/phase
  }, [running, phase, addSession, courseId, mode, activityKind, lessonLabel, profile, presetId, settings]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  const startFocus = () => {
    setShowRecall(false);
    setPhase("focus");
    setLeft(focusMinutes() * 60);
    startedAt.current = Date.now();
    focusAccum.current = 0;
    setRunning(true);
  };

  const pause = () => {
    if (phase === "focus" && startedAt.current) {
      focusAccum.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
    setRunning(false);
  };

  const resume = () => {
    if (phase === "focus") startedAt.current = Date.now();
    setRunning(true);
  };

  const stopAndLog = () => {
    if (phase === "focus") {
      const end = Date.now();
      const start = startedAt.current ?? end;
      const minutes = Math.max(
        0,
        Math.round((end - start + focusAccum.current) / 60000),
      );
      if (minutes > 0) {
        addSession({
          courseId,
          startedAt: start - focusAccum.current,
          endedAt: end,
          minutes,
          mode,
          label: lessonLabel.trim() || `${ACTIVITY_LABELS[activityKind]} (manual stop)`,
          activityKind,
          ...(lessonLabel.trim() ? { lessonLabel: lessonLabel.trim() } : {}),
        });
        setShowRecall(activityKind !== "break");
      }
    }
    startedAt.current = null;
    focusAccum.current = 0;
    setRunning(false);
    setPhase("idle");
    setLeft(focusMinutes() * 60);
  };

  const filtered = sessions.filter((s) =>
    filterCourse === "all" ? true : s.courseId === filterCourse,
  );

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <SectionHead
          title="Focus Timer & sessions"
          subtitle="VU presets · Pomodoro · Deep — logs only real elapsed time (never invents study minutes)"
        />
        <div className="mb-4 flex flex-wrap gap-1.5">
          {VU_TIMER_PRESETS.map((p) => (
            <Btn
              key={p.id}
              variant={profile === "preset" && presetId === p.id ? "primary" : "ghost"}
              className="!py-1"
              onClick={() => {
                setProfile("preset");
                setPresetId(p.id);
                setActivityKind(presetToActivity(p.id));
                if (phase === "idle") setLeft(p.minutes * 60);
              }}
            >
              {p.id === "gdb" ? "GDB" : p.id === "quizPrep" ? "Quiz prep" : p.id} {p.minutes}m
            </Btn>
          ))}
          <Btn
            variant={profile === "pomodoro" ? "teal" : "ghost"}
            className="!py-1"
            onClick={() => {
              setProfile("pomodoro");
              if (phase === "idle") setLeft(settings.pomodoroFocus * 60);
            }}
          >
            Pomodoro {settings.pomodoroFocus}/{settings.pomodoroBreak}
          </Btn>
          <Btn
            variant={profile === "deep" ? "teal" : "ghost"}
            className="!py-1"
            onClick={() => {
              setProfile("deep");
              if (phase === "idle") setLeft(settings.deepFocus * 60);
            }}
          >
            Deep {settings.deepFocus}/{settings.deepBreak}
          </Btn>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--hp-border)] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_55%),var(--hp-elevated)] px-4 py-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--hp-muted)]">
              {phase === "idle" ? "Ready" : phase === "focus" ? "Focus" : "Break"} ·{" "}
              {profile === "preset" ? ACTIVITY_LABELS[activityKind] : profile}
            </div>
            <div className="hp-title mt-2 text-6xl font-bold tabular-nums tracking-tight text-[var(--hp-ink)] sm:text-7xl">
              {mm}:{ss}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {phase === "idle" || (!running && phase === "break") ? (
                <Btn onClick={startFocus}>Start focus</Btn>
              ) : null}
              {running ? (
                <Btn variant="ghost" onClick={pause}>
                  Pause
                </Btn>
              ) : null}
              {!running && phase === "focus" ? (
                <Btn variant="teal" onClick={resume}>
                  Resume
                </Btn>
              ) : null}
              {phase !== "idle" ? (
                <Btn variant="danger" onClick={stopAndLog}>
                  Stop &amp; log
                </Btn>
              ) : null}
            </div>
            {showRecall ? (
              <div className="mt-5 max-w-md rounded-lg border border-[var(--hp-teal)]/30 bg-[color-mix(in_srgb,var(--hp-teal)_10%,transparent)] px-3 py-3 text-sm">
                <strong className="text-[var(--hp-ink)]">2-minute recall:</strong>{" "}
                <span className="text-[var(--hp-muted)]">
                  Close notes. Say one question you can answer from that block.
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn
                    variant="teal"
                    className="!py-1"
                    onClick={() => {
                      toggleDiscipline("recall-after-block");
                      setShowRecall(false);
                    }}
                  >
                    Marked recall
                  </Btn>
                  <Btn variant="ghost" className="!py-1" onClick={() => setShowRecall(false)}>
                    Dismiss
                  </Btn>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <Field label="Course">
              <select className="hp-field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Activity kind">
              <select
                className="hp-field"
                value={activityKind}
                onChange={(e) => setActivityKind(e.target.value as FocusActivityKind)}
              >
                {(Object.keys(ACTIVITY_LABELS) as FocusActivityKind[]).map((k) => (
                  <option key={k} value={k}>
                    {ACTIVITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lesson / topic (optional)">
              <input
                className="hp-field"
                value={lessonLabel}
                onChange={(e) => setLessonLabel(e.target.value)}
                placeholder="e.g. CS101 Lec 05 · owner label only"
              />
            </Field>
            <Field label="Day mode tag">
              <select
                className="hp-field"
                value={mode}
                onChange={(e) => setMode(e.target.value as StudyMode)}
              >
                <option value="normal">Normal</option>
                <option value="busy">Busy</option>
                <option value="rescue">Rescue</option>
              </select>
            </Field>
            <p className="text-xs text-[var(--hp-muted)]">
              Pomodoro {settings.pomodoroFocus}/{settings.pomodoroBreak} · Deep {settings.deepFocus}/
              {settings.deepBreak} — change lengths in Vault.
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHead
          title="Session log"
          subtitle="Source of truth for Analytics · filter by course"
          action={
            <select
              className="hp-field !w-auto !py-1.5 text-sm"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          }
        />
        {!filtered.length ? (
          <p className="text-sm text-[var(--hp-muted)]">No sessions logged yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--hp-border)]">
            {filtered.slice(0, 20).map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>
                  {courses.find((c) => c.id === s.courseId)?.code ?? "—"} · {s.label}
                  {s.activityKind ? (
                    <span className="text-[var(--hp-muted)]">
                      {" "}
                      · {ACTIVITY_LABELS[s.activityKind] ?? s.activityKind}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-[var(--hp-teal)]">{s.minutes}m</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
