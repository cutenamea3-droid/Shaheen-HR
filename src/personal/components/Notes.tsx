import { useState } from "react";
import { Btn, Empty, Field, Panel, SectionHead, courseLabel } from "./common";
import { usePersonal } from "@/personal/lib/store";

export function Notes() {
  const courses = usePersonal((s) => s.courses);
  const notes = usePersonal((s) => s.notes);
  const upsertNote = usePersonal((s) => s.upsertNote);
  const removeNote = usePersonal((s) => s.removeNote);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const sorted = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCourseId("general");
  };

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Notes & revision"
          subtitle="Personal-only notes — cloud-synced when secure mode is on; never company stores"
        />
        <div className="grid gap-3">
          <Field label="Course">
            <select className="hp-field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="general">General revision</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input className="hp-field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Body">
            <textarea
              className="hp-field min-h-[140px] py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Revision bullets, formulas, VULMS reminders…"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Btn
              onClick={() => {
                if (!title.trim()) return;
                upsertNote({
                  id: editingId ?? Math.random().toString(36).slice(2, 10),
                  courseId: courseId as "general" | string,
                  title: title.trim(),
                  body,
                  updatedAt: Date.now(),
                  tags: [],
                });
                reset();
              }}
            >
              {editingId ? "Update note" : "Save note"}
            </Btn>
            {editingId ? (
              <Btn variant="ghost" onClick={reset}>
                Cancel
              </Btn>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHead title="Library" />
        {!sorted.length ? (
          <Empty>No notes yet. Everything you write stays on this device under personal keys.</Empty>
        ) : (
          <ul className="space-y-2">
            {sorted.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{n.title}</div>
                    <div className="text-xs text-[var(--hp-muted)]">
                      {courseLabel(courses, n.courseId)} ·{" "}
                      {new Date(n.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        setEditingId(n.id);
                        setTitle(n.title);
                        setBody(n.body);
                        setCourseId(n.courseId);
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn variant="danger" onClick={() => removeNote(n.id)}>
                      Delete
                    </Btn>
                  </div>
                </div>
                {n.body ? (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-[var(--hp-ink)]/90">
                    {n.body}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
