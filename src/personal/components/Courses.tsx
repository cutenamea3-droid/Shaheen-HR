import { useState } from "react";
import { Btn, Field, Panel, SectionHead } from "./common";
import { usePersonal } from "@/personal/lib/store";

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function Courses() {
  const courses = usePersonal((s) => s.courses);
  const updateCourse = usePersonal((s) => s.updateCourse);

  return (
    <Panel>
      <SectionHead
        title="Courses"
        subtitle="VU BS IT · Fall 2026 — leave lecture fields blank until you know real counts"
      />
      <div className="space-y-4">
        {courses.map((c) => (
          <CourseEditor
            key={c.id}
            id={c.id}
            code={c.code}
            title={c.title}
            lecturesTotal={c.lecturesTotal}
            lecturesDone={c.lecturesDone}
            notes={c.notes}
            isTbd={c.isTbd}
            onSave={(p) => updateCourse(c.id, p)}
          />
        ))}
      </div>
    </Panel>
  );
}

function CourseEditor({
  id,
  code,
  title,
  lecturesTotal,
  lecturesDone,
  notes,
  isTbd,
  onSave,
}: {
  id: string;
  code: string;
  title: string;
  lecturesTotal: number | null;
  lecturesDone: number | null;
  notes: string;
  isTbd: boolean;
  onSave: (p: {
    code?: string;
    title?: string;
    lecturesTotal?: number | null;
    lecturesDone?: number | null;
    notes?: string;
  }) => void;
}) {
  const [codeV, setCodeV] = useState(code);
  const [titleV, setTitleV] = useState(title);
  const [totalV, setTotalV] = useState(lecturesTotal == null ? "" : String(lecturesTotal));
  const [doneV, setDoneV] = useState(lecturesDone == null ? "" : String(lecturesDone));
  const [notesV, setNotesV] = useState(notes);

  return (
    <div className="rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-[var(--hp-violet)]/20 px-2 py-0.5 text-xs font-bold text-[var(--hp-violet)]">
          {isTbd ? "Editable TBD" : id.toUpperCase()}
        </span>
        <span className="text-xs text-[var(--hp-muted)]">Private · local only</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code">
          <input
            className="hp-field"
            value={codeV}
            onChange={(e) => setCodeV(e.target.value)}
            disabled={!isTbd && code !== "TBD"}
          />
        </Field>
        <Field label="Title">
          <input className="hp-field" value={titleV} onChange={(e) => setTitleV(e.target.value)} />
        </Field>
        <Field label="Lectures total (optional)">
          <input
            className="hp-field"
            inputMode="numeric"
            placeholder="Leave blank if unknown"
            value={totalV}
            onChange={(e) => setTotalV(e.target.value)}
          />
        </Field>
        <Field label="Lectures done (optional)">
          <input
            className="hp-field"
            inputMode="numeric"
            placeholder="Leave blank — do not invent"
            value={doneV}
            onChange={(e) => setDoneV(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Private notes">
        <textarea
          className="hp-field min-h-[72px] py-2"
          value={notesV}
          onChange={(e) => setNotesV(e.target.value)}
        />
      </Field>
      <div className="mt-3">
        <Btn
          onClick={() =>
            onSave({
              code: codeV.trim() || code,
              title: titleV.trim() || title,
              lecturesTotal: numOrNull(totalV),
              lecturesDone: numOrNull(doneV),
              notes: notesV,
            })
          }
        >
          Save course
        </Btn>
      </div>
    </div>
  );
}
