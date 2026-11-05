import { useState } from "react";
import { Btn, Empty, Field, Panel, SectionHead, courseLabel } from "./common";
import { usePersonal } from "@/personal/lib/store";
import type { AssessmentKind } from "@/personal/lib/types";

const KINDS: AssessmentKind[] = ["assignment", "quiz", "midterm", "final", "other"];

export function Assessments() {
  const courses = usePersonal((s) => s.courses);
  const assessments = usePersonal((s) => s.assessments);
  const settings = usePersonal((s) => s.settings);
  const setSettings = usePersonal((s) => s.setSettings);
  const upsertAssessment = usePersonal((s) => s.upsertAssessment);
  const toggleAssessment = usePersonal((s) => s.toggleAssessment);
  const removeAssessment = usePersonal((s) => s.removeAssessment);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AssessmentKind>("assignment");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "cs101");
  const [dueDate, setDueDate] = useState("");
  const [mid, setMid] = useState(settings.midtermRef);
  const [fin, setFin] = useState(settings.finalsRef);

  const open = assessments
    .filter((a) => !a.done)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Semester exam references"
          subtitle="Editable anchors only — always verify paper schedules on VULMS"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Midterm ref">
            <input className="hp-field" type="date" value={mid} onChange={(e) => setMid(e.target.value)} />
          </Field>
          <Field label="Finals ref">
            <input className="hp-field" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Btn
            onClick={() => {
              setSettings({ midtermRef: mid, finalsRef: fin });
              upsertAssessment({
                id: "midterm-ref",
                courseId: "general",
                kind: "midterm",
                title: "Midterm exams (semester ref)",
                dueDate: mid,
                notes: "Editable reference only. Confirm exact paper dates on VULMS.",
                done: false,
                verifyOnVulms: true,
              });
              upsertAssessment({
                id: "finals-ref",
                courseId: "general",
                kind: "final",
                title: "Final exams (semester ref)",
                dueDate: fin,
                notes: "Editable reference only. Confirm exact paper dates on VULMS.",
                done: false,
                verifyOnVulms: true,
              });
            }}
          >
            Save exam refs
          </Btn>
        </div>
      </Panel>

      <Panel>
        <SectionHead title="Assignments · quizzes · exams" subtitle="Track only items you confirm" />
        <form
          className="mb-4 grid gap-3 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !dueDate) return;
            upsertAssessment({
              id: Math.random().toString(36).slice(2, 10),
              courseId,
              kind,
              title: title.trim(),
              dueDate,
              notes: "",
              done: false,
              verifyOnVulms: true,
            });
            setTitle("");
          }}
        >
          <Field label="Title">
            <input className="hp-field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Due date">
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
                  {k}
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
          <Empty>No open assessments beyond what you add.</Empty>
        ) : (
          <ul className="space-y-2">
            {open.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hp-border)] px-3 py-2"
              >
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-[var(--hp-muted)]">
                    {a.dueDate} · {courseLabel(courses, a.courseId)} · {a.kind}
                    {a.verifyOnVulms ? " · verify VULMS" : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn variant="teal" onClick={() => toggleAssessment(a.id)}>
                    Done
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
