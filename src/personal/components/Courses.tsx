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
        subtitle="From My Courses + Study Scheme — leave lecture counts blank unless you know them from Progress/Lessons"
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
            {...(c.requirementType ? { requirementType: c.requirementType } : {})}
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
  requirementType,
  onSave,
}: {
  id: string;
  code: string;
  title: string;
  lecturesTotal: number | null;
  lecturesDone: number | null;
  notes: string;
  isTbd: boolean;
  requirementType?: "Required" | "Elective" | "unknown";
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
        {requirementType ? (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              requirementType === "Elective"
                ? "bg-[var(--hp-teal)]/15 text-[var(--hp-teal)]"
                : "bg-[var(--hp-blue)]/15 text-[var(--hp-blue-bright)]"
            }`}
          >
            {requirementType}
          </span>
        ) : null}
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
