import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Btn, Empty, Field, Panel, SectionHead, courseLabel } from "./common";
import { usePersonal } from "@/personal/lib/store";
import {
  PRACTICE_CHECKLIST,
  REVISION_TAG_PRESETS,
  filterNotesByTag,
  suggestRevisionTargets,
} from "@/personal/lib/revision";
import { vuQuickLinks } from "@/personal/lib/vu-rhythm";

export function Notes() {
  const courses = usePersonal((s) => s.courses);
  const notes = usePersonal((s) => s.notes);
  const assessments = usePersonal((s) => s.assessments);
  const upsertNote = usePersonal((s) => s.upsertNote);
  const removeNote = usePersonal((s) => s.removeNote);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagDraft, setTagDraft] = useState("revision");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [linkCourse, setLinkCourse] = useState(courses[0]?.code ?? "CS101");
  const [practiceDone, setPracticeDone] = useState<Record<string, boolean>>({});

  const suggestions = useMemo(
    () => suggestRevisionTargets(courses, assessments, notes),
    [courses, assessments, notes],
  );

  const sorted = filterNotesByTag(notes, filterTag)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const links = vuQuickLinks(linkCourse);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCourseId("general");
    setTagDraft("revision");
  };

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Smart Revision & practice"
          subtitle="Suggestions from your open deadlines + note gaps — never invents VU lesson content"
        />
        {!suggestions.length ? (
          <p className="text-sm text-[var(--hp-muted)]">
            No revision targets yet. Add assessments or capture course notes.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] px-3 py-2"
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--hp-ink)]">
                    {s.courseCode}{" "}
                    <span
                      className={`ml-1 text-[10px] font-bold uppercase tracking-wide ${
                        s.urgency === "high"
                          ? "text-[var(--hp-amber)]"
                          : s.urgency === "medium"
                            ? "text-[var(--hp-blue-bright)]"
                            : "text-[var(--hp-muted)]"
                      }`}
                    >
                      {s.urgency}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--hp-muted)]">{s.reason}</div>
                </div>
                <Btn
                  variant="ghost"
                  className="!py-1"
                  onClick={() => {
                    setCourseId(s.courseId === "general" ? "general" : s.courseId);
                    setTagDraft("revision");
                    setTitle(`${s.courseCode} revision`);
                  }}
                >
                  Draft note
                </Btn>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-dashed border-[var(--hp-border)] p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hp-muted)]">
            Practice checklist (owner marks — local only)
          </div>
          <ul className="mt-2 space-y-1.5">
            {PRACTICE_CHECKLIST.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!practiceDone[item.id]}
                  onChange={() =>
                    setPracticeDone((p) => ({ ...p, [item.id]: !p[item.id] }))
                  }
                />
                <span className={practiceDone[item.id] ? "text-[var(--hp-muted)] line-through" : ""}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel>
        <SectionHead
          title="Notes"
          subtitle="Personal-only — cloud-synced when secure mode is on; never company stores"
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
          <Field label="Tag">
            <div className="flex flex-wrap gap-1.5">
              {REVISION_TAG_PRESETS.map((t) => (
                <Btn
                  key={t}
                  variant={tagDraft === t ? "primary" : "ghost"}
                  className="!py-1"
                  onClick={() => setTagDraft(t)}
                >
                  {t}
                </Btn>
              ))}
            </div>
          </Field>
          <Field label="Body">
            <textarea
              className="hp-field min-h-[140px] py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Revision bullets, formulas, VULMS reminders — owner text only…"
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
                  tags: tagDraft ? [tagDraft] : [],
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
        <SectionHead
          title="Library"
          action={
            <select
              className="hp-field !w-auto !py-1.5 text-sm"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="all">All tags</option>
              {REVISION_TAG_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          }
        />
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
                      {n.tags.length ? n.tags.join(", ") + " · " : ""}
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
                        setTagDraft(n.tags[0] ?? "revision");
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

      <Panel>
        <SectionHead
          title="VU Quick Links"
          subtitle="Official homes + search-by-course — never fabricates lesson video IDs"
          action={
            <select
              className="hp-field !w-auto !py-1.5 text-sm"
              value={linkCourse}
              onChange={(e) => setLinkCourse(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          }
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] px-3 py-2 no-underline transition hover:border-[var(--hp-violet)]/40"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--hp-teal)]" />
                <span>
                  <span className="block text-sm font-semibold text-[var(--hp-ink)]">{l.label}</span>
                  <span className="block text-xs text-[var(--hp-muted)]">{l.blurb}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
