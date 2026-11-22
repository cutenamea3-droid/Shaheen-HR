import { useRef, useState } from "react";
import { Btn, Field, Panel, SectionHead } from "./common";
import { usePersonal } from "@/personal/lib/store";
import { normalizeCourse } from "@/personal/lib/assessment-phases";
import type { Course } from "@/personal/lib/types";

const asTxt = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

function numOrNull(raw: string): number | null {
  const t = asTxt(raw).trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function Courses() {
  const coursesRaw = usePersonal((s) => s.courses);
  const courses = (Array.isArray(coursesRaw) ? coursesRaw : [])
    .map((c) => normalizeCourse(c as Partial<Course> & Pick<Course, "id">))
    .filter((c) => !!c.id);
  const updateCourse = usePersonal((s) => s.updateCourse);

  return (
    <Panel>
      <SectionHead
        title="Courses · Lectures"
        subtitle="Seeded only from My Courses + Study Scheme exports — leave lecture totals/done blank unless Progress/Lessons confirm them (never invent)"
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
  const [codeV, setCodeV] = useState(asTxt(code));
  const [titleV, setTitleV] = useState(asTxt(title));
  const [totalV, setTotalV] = useState(lecturesTotal == null ? "" : String(lecturesTotal));
  const [doneV, setDoneV] = useState(lecturesDone == null ? "" : String(lecturesDone));
  const [notesV, setNotesV] = useState(asTxt(notes));
  const codeRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const totalRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-[var(--hp-violet)]/20 px-2 py-0.5 text-xs font-bold text-[var(--hp-violet)]">
          {isTbd
            ? "Editable TBD"
            : (id == null ? "" : typeof id === "string" ? id : String(id)).toUpperCase()}
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
            ref={codeRef}
            className="hp-field"
            value={codeV}
            onChange={(e) => setCodeV(e.target.value)}
            onInput={(e) => setCodeV((e.target as HTMLInputElement).value)}
            disabled={!isTbd && code !== "TBD"}
          />
        </Field>
        <Field label="Title">
          <input
            ref={titleRef}
            className="hp-field"
            value={titleV}
            onChange={(e) => setTitleV(e.target.value)}
            onInput={(e) => setTitleV((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label="Lectures total (optional)">
          <input
            ref={totalRef}
            className="hp-field"
            inputMode="numeric"
            placeholder="Leave blank if unknown"
            value={totalV}
            onChange={(e) => setTotalV(e.target.value)}
            onInput={(e) => setTotalV((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label="Lectures done (optional)">
          <input
            ref={doneRef}
            className="hp-field"
            inputMode="numeric"
            placeholder="Leave blank — do not invent"
            value={doneV}
            onChange={(e) => setDoneV(e.target.value)}
            onInput={(e) => setDoneV((e.target as HTMLInputElement).value)}
          />
        </Field>
      </div>
      <Field label="Private notes">
        <textarea
          ref={notesRef}
          className="hp-field min-h-[72px] py-2"
          value={notesV}
          onChange={(e) => setNotesV(e.target.value)}
          onInput={(e) => setNotesV((e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <div className="mt-3">
        <Btn
          data-testid="personal-course-save"
          onClick={() => {
            const nextCode =
              (asTxt(codeV).trim() || codeRef.current?.value || asTxt(code)).trim() || asTxt(code);
            const nextTitle =
              (asTxt(titleV).trim() || titleRef.current?.value || asTxt(title)).trim() ||
              asTxt(title);
            const nextTotal = asTxt(totalV).trim() || totalRef.current?.value || "";
            const nextDone = asTxt(doneV).trim() || doneRef.current?.value || "";
            const nextNotes = asTxt(notesV).length ? asTxt(notesV) : notesRef.current?.value || "";
            onSave({
              code: nextCode,
              title: nextTitle,
              lecturesTotal: numOrNull(nextTotal),
              lecturesDone: numOrNull(nextDone),
              notes: nextNotes,
            });
          }}
        >
          Save course
        </Btn>
      </div>
    </div>
  );
}
