import { useMemo, useState } from "react";
import { Btn, Empty, Field, Panel, SectionHead, courseLabel } from "./common";
import { deadlineBadge } from "@/personal/lib/assessment-phases";
import { usePersonal } from "@/personal/lib/store";
import type { AssessmentKind, DeadlineSource, ExamPrepTask } from "@/personal/lib/types";

const KINDS: AssessmentKind[] = ["assignment", "quiz", "gdb", "midterm", "final", "other"];

const EXAM_PREP_STARTERS: { examKind: ExamPrepTask["examKind"]; label: string }[] = [
  { examKind: "midterm", label: "Handout revision pass (owner)" },
  { examKind: "midterm", label: "Past-paper / MCQ block (owner)" },
  { examKind: "final", label: "Mistake review pass (owner)" },
  { examKind: "final", label: "Verify date sheet on VULMS" },
];

function DeadlineChip({ source }: { source: DeadlineSource | undefined }) {
  const badge = deadlineBadge(source);
  const cls =
    badge.tone === "verified"
      ? "bg-[var(--hp-teal)]/15 text-[var(--hp-teal)]"
      : badge.tone === "estimated"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
        : badge.tone === "user"
          ? "bg-[var(--hp-blue)]/15 text-[var(--hp-blue-bright)]"
          : "bg-[var(--hp-border)] text-[var(--hp-muted)]";
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {badge.label}
    </span>
  );
}

export function Assessments() {
  const courses = usePersonal((s) => s.courses);
  const assessments = usePersonal((s) => s.assessments);
  const settings = usePersonal((s) => s.settings);
  const setSettings = usePersonal((s) => s.setSettings);
  const upsertAssessment = usePersonal((s) => s.upsertAssessment);
  const setAssessmentPrep = usePersonal((s) => s.setAssessmentPrep);
  const setAssessmentSubmitted = usePersonal((s) => s.setAssessmentSubmitted);
  const removeAssessment = usePersonal((s) => s.removeAssessment);
  const examPrepTasks = usePersonal((s) => s.examPrepTasks);
  const upsertExamPrepTask = usePersonal((s) => s.upsertExamPrepTask);
  const toggleExamPrepTask = usePersonal((s) => s.toggleExamPrepTask);
  const removeExamPrepTask = usePersonal((s) => s.removeExamPrepTask);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AssessmentKind>("assignment");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "cs101");
  const [dueDate, setDueDate] = useState("");
  const [mid, setMid] = useState(settings.midtermRef);
  const [fin, setFin] = useState(settings.finalsRef);
  const [prepCourseId, setPrepCourseId] = useState(courses[0]?.id ?? "cs101");
  const [prepLabel, setPrepLabel] = useState("");
  const [prepKind, setPrepKind] = useState<ExamPrepTask["examKind"]>("midterm");

  const daysUntil = (iso: string) => {
    if (!iso) return null;
    const due = Date.parse(`${iso}T23:59:59`);
    if (Number.isNaN(due)) return null;
    return Math.ceil((due - Date.now()) / 86400000);
  };
  const midDays = daysUntil(settings.midtermRef);
  const finDays = daysUntil(settings.finalsRef);

  const open = useMemo(
    () =>
      assessments
        .filter((a) => !a.submitted && !a.done)
        .slice()
        .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")),
    [assessments],
  );

  const verified = open.filter((a) => a.deadlineSource === "vulms_todo");
  const otherDeadlines = open.filter((a) => a.deadlineSource !== "vulms_todo");

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="VU Deadlines"
          subtitle="Verified = To-Do Calendar export window · Estimated / user-entered are never treated as VULMS fact"
        />
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hp-teal)]">
              Verified
            </div>
            <div className="hp-title mt-1 text-2xl font-bold tabular-nums">{verified.length}</div>
            <p className="mt-1 text-xs text-[var(--hp-muted)]">
              Due dates copied from To-Do Calendar HTML export only.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300">
              Estimated / user / unset
            </div>
            <div className="hp-title mt-1 text-2xl font-bold tabular-nums">{otherDeadlines.length}</div>
            <p className="mt-1 text-xs text-[var(--hp-muted)]">
              Planning timers and owner-typed dates — verify on VULMS before relying on them.
            </p>
          </div>
        </div>
        <p className="rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-2 text-xs text-[var(--hp-muted)]">
          Prep ≠ submit: marking <strong>Prep done</strong> never marks Submitted. Mark{" "}
          <strong>Submitted</strong> only after you attempt/upload/post on VULMS.
        </p>
      </Panel>

      <Panel>
        <SectionHead
          title="Semester exam references"
          subtitle="Leave blank until a date sheet is published — this workspace never invents mid/final windows"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Midterm ref (optional)">
            <input
              className="hp-field"
              type="date"
              value={mid}
              onChange={(e) => setMid(e.target.value)}
            />
          </Field>
          <Field label="Finals ref (optional)">
            <input
              className="hp-field"
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              setSettings({ midtermRef: mid, finalsRef: fin });
              if (mid) {
                upsertAssessment({
                  id: "midterm-ref",
                  courseId: "general",
                  kind: "midterm",
                  title: "Midterm exams (owner date-sheet ref)",
                  dueDate: mid,
                  notes: "User-entered after confirming VULMS/date sheet — not from export seed.",
                  prepDone: false,
                  submitted: false,
                  done: false,
                  verifyOnVulms: true,
                  deadlineSource: "user_entered",
                });
              }
              if (fin) {
                upsertAssessment({
                  id: "finals-ref",
                  courseId: "general",
                  kind: "final",
                  title: "Final exams (owner date-sheet ref)",
                  dueDate: fin,
                  notes: "User-entered after confirming VULMS/date sheet — not from export seed.",
                  prepDone: false,
                  submitted: false,
                  done: false,
                  verifyOnVulms: true,
                  deadlineSource: "user_entered",
                });
              }
            }}
          >
            Save exam refs
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              setMid("");
              setFin("");
              setSettings({ midtermRef: "", finalsRef: "" });
              removeAssessment("midterm-ref");
              removeAssessment("finals-ref");
            }}
          >
            Clear exam refs
          </Btn>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-2 text-xs text-[var(--hp-muted)]">
            Midterm countdown:{" "}
            <strong className="text-[var(--hp-ink)]">
              {midDays == null ? "—" : midDays >= 0 ? `${midDays}d` : "passed"}
            </strong>{" "}
            (only after owner date-sheet ref)
          </p>
          <p className="rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-2 text-xs text-[var(--hp-muted)]">
            Finals countdown:{" "}
            <strong className="text-[var(--hp-ink)]">
              {finDays == null ? "—" : finDays >= 0 ? `${finDays}d` : "passed"}
            </strong>{" "}
            (only after owner date-sheet ref)
          </p>
        </div>
      </Panel>

      <Panel>
        <SectionHead
          title="Exam Prep"
          subtitle="Checklist only — Prep ≠ submit · never invents date-sheet content or VU past-paper text"
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {EXAM_PREP_STARTERS.map((s) => (
            <Btn
              key={`${s.examKind}-${s.label}`}
              variant="ghost"
              className="!py-1"
              onClick={() =>
                upsertExamPrepTask({
                  id: Math.random().toString(36).slice(2, 10),
                  courseId: prepCourseId,
                  examKind: s.examKind,
                  label: s.label,
                  done: false,
                  notes: "",
                })
              }
            >
              + {s.label}
            </Btn>
          ))}
        </div>
        <div className="mb-4 grid gap-3 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3 md:grid-cols-3">
          <Field label="Course">
            <select
              className="hp-field"
              value={prepCourseId}
              onChange={(e) => setPrepCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Exam kind">
            <select
              className="hp-field"
              value={prepKind}
              onChange={(e) => setPrepKind(e.target.value as ExamPrepTask["examKind"])}
            >
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="quiz">Quiz</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Custom task">
            <div className="flex gap-2">
              <input
                className="hp-field"
                value={prepLabel}
                onChange={(e) => setPrepLabel(e.target.value)}
                placeholder="Owner task…"
              />
              <Btn
                onClick={() => {
                  if (!prepLabel.trim()) return;
                  upsertExamPrepTask({
                    id: Math.random().toString(36).slice(2, 10),
                    courseId: prepCourseId,
                    examKind: prepKind,
                    label: prepLabel.trim(),
                    done: false,
                    notes: "",
                  });
                  setPrepLabel("");
                }}
              >
                Add
              </Btn>
            </div>
          </Field>
        </div>
        {!examPrepTasks.length ? (
          <Empty>
            No exam-prep tasks yet. Add starters after you have a date sheet — leave blank until then.
          </Empty>
        ) : (
          <ul className="space-y-2">
            {examPrepTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hp-border)] px-3 py-2"
              >
                <div>
                  <div className={`text-sm font-semibold ${t.done ? "text-[var(--hp-muted)] line-through" : ""}`}>
                    {t.label}
                  </div>
                  <div className="text-xs text-[var(--hp-muted)]">
                    {courseLabel(courses, t.courseId)} · {t.examKind} · prep checklist (≠ VULMS submit)
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn variant={t.done ? "teal" : "ghost"} onClick={() => toggleExamPrepTask(t.id)}>
                    {t.done ? "Done" : "Mark done"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => removeExamPrepTask(t.id)}>
                    Remove
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionHead
          title="Assignment · Quiz · GDB"
          subtitle="Track prep separately from VULMS submit — GDB is a first-class kind"
        />
        <form
          className="mb-4 grid gap-3 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            upsertAssessment({
              id: Math.random().toString(36).slice(2, 10),
              courseId,
              kind,
              title: title.trim(),
              dueDate,
              notes: dueDate
                ? "Owner-entered deadline — verify on VULMS."
                : "No due date — unset until confirmed on VULMS.",
              prepDone: false,
              submitted: false,
              done: false,
              verifyOnVulms: true,
              deadlineSource: dueDate ? "user_entered" : "unset",
            });
            setTitle("");
            setDueDate("");
          }}
        >
          <Field label="Title">
            <input className="hp-field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Due date (optional)">
            <input
              className="hp-field"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
          <Field label="Kind">
            <select className="hp-field" value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k === "gdb" ? "GDB" : k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course">
            <select className="hp-field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="general">General</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Btn type="submit">Add assessment</Btn>
          </div>
        </form>

        {!open.length ? (
          <Empty>No open assessments. Import To-Do Calendar exports or add items you confirm.</Empty>
        ) : (
          <ul className="space-y-2">
            {open.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hp-border)] px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="font-semibold">{a.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--hp-muted)]">
                    <span>
                      {a.dueDate || "no date"} · {courseLabel(courses, a.courseId)} ·{" "}
                      {a.kind === "gdb" ? "GDB" : a.kind}
                    </span>
                    <DeadlineChip source={a.deadlineSource} />
                    {a.prepDone ? (
                      <span className="rounded bg-[var(--hp-violet)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--hp-violet)]">
                        Prep done
                      </span>
                    ) : (
                      <span className="rounded bg-[var(--hp-border)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--hp-muted)]">
                        Prep pending
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn
                    variant={a.prepDone ? "ghost" : "primary"}
                    onClick={() => setAssessmentPrep(a.id, !a.prepDone)}
                  >
                    {a.prepDone ? "Undo prep" : "Prep done"}
                  </Btn>
                  <Btn variant="teal" onClick={() => setAssessmentSubmitted(a.id, true)}>
                    Mark submitted
                  </Btn>
                  <Btn variant="ghost" onClick={() => removeAssessment(a.id)}>
                    Remove
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
