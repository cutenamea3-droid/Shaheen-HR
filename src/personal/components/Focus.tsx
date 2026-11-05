import { useEffect, useRef, useState } from "react";
import { Btn, Field, Panel, SectionHead } from "./common";
import { usePersonal } from "@/personal/lib/store";
import type { StudyMode } from "@/personal/lib/types";

type Phase = "focus" | "break" | "idle";

export function Focus() {
  const courses = usePersonal((s) => s.courses);
  const settings = usePersonal((s) => s.settings);
  const addSession = usePersonal((s) => s.addSession);
  const sessions = usePersonal((s) => s.sessions);

  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "cs101");
  const [mode, setMode] = useState<StudyMode>("normal");
  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(settings.pomodoroFocus * 60);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);
  const focusAccum = useRef(0);

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
              label: "Pomodoro focus",
            });
            focusAccum.current = 0;
            startedAt.current = null;
            setPhase("break");
            setLeft(settings.pomodoroBreak * 60);
          } else {
            setPhase("idle");
            setLeft(settings.pomodoroFocus * 60);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, phase, addSession, courseId, mode, settings.pomodoroBreak, settings.pomodoroFocus]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  const startFocus = () => {
    setPhase("focus");
    setLeft(settings.pomodoroFocus * 60);
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
          label: "Focus (manual stop)",
        });
      }
    }
    startedAt.current = null;
    focusAccum.current = 0;
    setRunning(false);
    setPhase("idle");
    setLeft(settings.pomodoroFocus * 60);
  };

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <SectionHead
          title="Focus mode"
          subtitle="Pomodoro logs only real elapsed time — never invents study minutes"
        />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--hp-border)] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_55%),var(--hp-elevated)] px-4 py-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--hp-muted)]">
              {phase === "idle" ? "Ready" : phase === "focus" ? "Focus" : "Break"}
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
              Focus {settings.pomodoroFocus}m · Break {settings.pomodoroBreak}m — change in Vault /
              Privacy settings.
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHead title="Recent sessions" subtitle="Source of truth for analytics" />
        {!sessions.length ? (
          <p className="text-sm text-[var(--hp-muted)]">No sessions logged yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--hp-border)]">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>
                  {courses.find((c) => c.id === s.courseId)?.code ?? "—"} · {s.label}
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
