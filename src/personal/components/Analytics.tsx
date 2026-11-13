import { useMemo, useState } from "react";
import { Btn, Field, Panel, SectionHead, Stat } from "./common";
import {
  consistencyDays,
  studyMinutesInRange,
  todayKey,
  usePersonal,
} from "@/personal/lib/store";
import {
  VU_LETTER_CHOICES,
  VU_WEIGHT_BANDS,
  estimateCgpa,
  estimateCourseAggregate,
  looksLikeProjectedDefault,
} from "@/personal/lib/gpa";
import {
  buildWeeklyStats,
  emptyWeeklyReview,
  weekStartMonday,
} from "@/personal/lib/weekly-review";

export function Analytics() {
  const sessions = usePersonal((s) => s.sessions);
  const backlog = usePersonal((s) => s.backlog);
  const courses = usePersonal((s) => s.courses);
  const dayPlans = usePersonal((s) => s.dayPlans);
  const assessments = usePersonal((s) => s.assessments);
  const discipline = usePersonal((s) => s.discipline);
  const gradeEntries = usePersonal((s) => s.gradeEntries);
  const courseGrades = usePersonal((s) => s.courseGrades);
  const weeklyReviews = usePersonal((s) => s.weeklyReviews);
  const upsertGradeEntry = usePersonal((s) => s.upsertGradeEntry);
  const removeGradeEntry = usePersonal((s) => s.removeGradeEntry);
  const upsertCourseGrade = usePersonal((s) => s.upsertCourseGrade);
  const removeCourseGrade = usePersonal((s) => s.removeCourseGrade);
  const upsertWeeklyReview = usePersonal((s) => s.upsertWeeklyReview);
  const toggleDiscipline = usePersonal((s) => s.toggleDiscipline);

  const now = Date.now();
  const m7 = studyMinutesInRange(sessions, now - 7 * 86400000, now);
  const m30 = studyMinutesInRange(sessions, now - 30 * 86400000, now);
  const days14 = consistencyDays(sessions, 14);
  const openBacklog = backlog.filter((b) => !b.done).length;
  const recovered = backlog.filter((b) => b.done).length;

  const byCourse = courses.map((c) => ({
    code: c.code,
    minutes: sessions
      .filter((s) => s.courseId === c.id)
      .reduce((sum, s) => sum + s.minutes, 0),
  }));

  const plansDone = Object.values(dayPlans).reduce(
    (acc, p) => {
      acc.total += p.blocks.length;
      acc.done += p.blocks.filter((b) => b.done).length;
      return acc;
    },
    { total: 0, done: 0 },
  );

  const cgpa = useMemo(() => estimateCgpa(courseGrades, courses), [courseGrades, courses]);

  const [gCourseId, setGCourseId] = useState(courses[0]?.id ?? "cs101");
  const [gLabel, setGLabel] = useState("");
  const [gScore, setGScore] = useState("");
  const [gMax, setGMax] = useState("");
  const [gProv, setGProv] = useState<"owner_recorded" | "owner_whatif">("owner_recorded");
  const [letterCourseId, setLetterCourseId] = useState(courses[0]?.id ?? "cs101");
  const [letter, setLetter] = useState("");
  const [letterProv, setLetterProv] = useState<"owner_recorded" | "owner_whatif">("owner_recorded");
  const [swPct, setSwPct] = useState("");
  const [fePct, setFePct] = useState("");

  const whatIf = estimateCourseAggregate({
    semesterWorkPct: swPct === "" ? null : Number(swPct),
    finalExamPct: fePct === "" ? null : Number(fePct),
  });

  const weekStart = weekStartMonday(todayKey());
  const weekly = buildWeeklyStats(weekStart, sessions, discipline, assessments);
  const review = weeklyReviews[weekStart] ?? emptyWeeklyReview(weekStart);
  const [wins, setWins] = useState(review.wins);
  const [blockers, setBlockers] = useState(review.blockers);
  const [nextFocus, setNextFocus] = useState(review.nextFocus);

  return (
    <div className="space-y-4">
      <Panel>
        <SectionHead
          title="Performance analytics"
          subtitle="Study minutes, backlog, consistency — zero invented progress"
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="7-day minutes" value={`${m7}`} hint="Logged Focus only" accent="teal" />
          <Stat label="30-day minutes" value={`${m30}`} hint="Logged Focus only" accent="blue" />
          <Stat
            label="Consistency (14d)"
            value={`${days14}/14`}
            hint="Days with ≥1 session"
            accent="violet"
          />
          <Stat
            label="Backlog"
            value={`${openBacklog}`}
            hint={`${recovered} recovered`}
            accent="amber"
          />
        </div>
        {sessions.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--hp-border)] px-3 py-3 text-sm text-[var(--hp-muted)]">
            Charts stay empty until you log real Focus time. No demo grades or fake completion.
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionHead title="Minutes by course" subtitle="Derived from Focus sessions" />
          <ul className="space-y-2">
            {byCourse.map((row) => {
              const max = Math.max(1, ...byCourse.map((r) => r.minutes));
              const w = Math.round((row.minutes / max) * 100);
              return (
                <li key={row.code}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{row.code}</span>
                    <span className="tabular-nums text-[var(--hp-muted)]">{row.minutes}m</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hp-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--hp-blue)]"
                      style={{ width: `${row.minutes ? w : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <SectionHead title="Plan completion" subtitle="Blocks you marked done on timetables" />
          <div className="hp-title text-4xl font-bold tabular-nums">
            {plansDone.done}
            <span className="text-lg text-[var(--hp-muted)]"> / {plansDone.total}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--hp-muted)]">
            Only counts blocks you explicitly completed. Empty when you have not used Timetable yet.
          </p>
        </Panel>
      </div>

      <Panel>
        <SectionHead
          title="Grades / GPA estimator"
          subtitle="Owner-entered only — ignores Grade Book projected 50/D · estimate ≠ earned CGPA"
        />
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label="CGPA estimate"
            value={cgpa.cgpa == null ? "—" : cgpa.cgpa.toFixed(2)}
            hint={
              cgpa.label === "empty"
                ? "Enter course letters below"
                : `${cgpa.gradedCourses} course(s) · ${cgpa.creditedHours} CH · estimate`
            }
            accent="violet"
          />
          <Stat
            label="Component rows"
            value={`${gradeEntries.length}`}
            hint="Owner-typed Grade Book lines"
            accent="blue"
          />
          <Stat
            label="40/60 what-if"
            value={whatIf.aggregate == null ? "—" : `${whatIf.aggregate}%`}
            hint={`Handbook bands ${VU_WEIGHT_BANDS.semesterWorkPercent}/${VU_WEIGHT_BANDS.endSemesterExamPercent}`}
            accent="teal"
          />
        </div>

        <div className="grid gap-3 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-elevated)] p-3 md:grid-cols-2">
          <Field label="Course letter (CGPA)">
            <select
              className="hp-field"
              value={letterCourseId}
              onChange={(e) => setLetterCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} ({c.creditHours ?? "?"} CH)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Letter">
            <select className="hp-field" value={letter} onChange={(e) => setLetter(e.target.value)}>
              <option value="">— unset —</option>
              {VU_LETTER_CHOICES.map((L) => (
                <option key={L} value={L}>
                  {L}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Provenance">
            <select
              className="hp-field"
              value={letterProv}
              onChange={(e) =>
                setLetterProv(e.target.value as "owner_recorded" | "owner_whatif")
              }
            >
              <option value="owner_recorded">Recorded (from Grade Book export I typed)</option>
              <option value="owner_whatif">What-if estimate</option>
            </select>
          </Field>
          <div className="flex items-end">
            <Btn
              onClick={() => {
                if (!letter.trim()) return;
                const course = courses.find((c) => c.id === letterCourseId);
                upsertCourseGrade({
                  id: `cg-${letterCourseId}`,
                  courseId: letterCourseId,
                  letter: letter.trim(),
                  creditHours: course?.creditHours ?? null,
                  provenance: letterProv,
                  notes: "",
                  updatedAt: Date.now(),
                });
                setLetter("");
              }}
            >
              Save course letter
            </Btn>
          </div>
        </div>

        {courseGrades.length ? (
          <ul className="mt-3 divide-y divide-[var(--hp-border)]">
            {courseGrades.map((g) => (
              <li key={g.id} className="flex justify-between gap-2 py-2 text-sm">
                <span>
                  {courses.find((c) => c.id === g.courseId)?.code ?? g.courseId} · {g.letter} ·{" "}
                  <span className="text-[var(--hp-muted)]">{g.provenance}</span>
                </span>
                <Btn variant="danger" className="!py-1" onClick={() => removeCourseGrade(g.id)}>
                  Remove
                </Btn>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--hp-muted)]">
            No course letters yet. CGPA stays blank until you enter them — never seeded.
          </p>
        )}

        <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-[var(--hp-border)] p-3 md:grid-cols-2">
          <Field label="Component label">
            <input
              className="hp-field"
              value={gLabel}
              onChange={(e) => setGLabel(e.target.value)}
              placeholder="e.g. Quiz 1 (from Grade Book)"
            />
          </Field>
          <Field label="Course">
            <select className="hp-field" value={gCourseId} onChange={(e) => setGCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Score">
            <input
              className="hp-field"
              type="number"
              value={gScore}
              onChange={(e) => setGScore(e.target.value)}
            />
          </Field>
          <Field label="Max">
            <input
              className="hp-field"
              type="number"
              value={gMax}
              onChange={(e) => setGMax(e.target.value)}
            />
          </Field>
          <Field label="Provenance">
            <select
              className="hp-field"
              value={gProv}
              onChange={(e) => setGProv(e.target.value as "owner_recorded" | "owner_whatif")}
            >
              <option value="owner_recorded">Recorded</option>
              <option value="owner_whatif">What-if</option>
            </select>
          </Field>
          <div className="flex items-end">
            <Btn
              onClick={() => {
                if (!gLabel.trim()) return;
                const score = gScore === "" ? null : Number(gScore);
                const maxScore = gMax === "" ? null : Number(gMax);
                if (looksLikeProjectedDefault(score, "D") && gProv === "owner_whatif") {
                  /* still allow explicit what-if; warn via notes */
                }
                if (looksLikeProjectedDefault(score, "D") && gProv === "owner_recorded") {
                  return; // refuse silent 50/D projected default as "recorded"
                }
                upsertGradeEntry({
                  id: Math.random().toString(36).slice(2, 10),
                  courseId: gCourseId,
                  label: gLabel.trim(),
                  score,
                  maxScore,
                  provenance: gProv,
                  notes: looksLikeProjectedDefault(score, "D")
                    ? "Flagged: resembles Grade Book projected 50/D default"
                    : "",
                  updatedAt: Date.now(),
                });
                setGLabel("");
                setGScore("");
                setGMax("");
              }}
            >
              Add component
            </Btn>
          </div>
        </div>

        {gradeEntries.length ? (
          <ul className="mt-3 divide-y divide-[var(--hp-border)]">
            {gradeEntries.map((g) => (
              <li key={g.id} className="flex justify-between gap-2 py-2 text-sm">
                <span>
                  {courses.find((c) => c.id === g.courseId)?.code} · {g.label} ·{" "}
                  {g.score ?? "—"}/{g.maxScore ?? "—"} ·{" "}
                  <span className="text-[var(--hp-muted)]">{g.provenance}</span>
                </span>
                <Btn variant="danger" className="!py-1" onClick={() => removeGradeEntry(g.id)}>
                  Remove
                </Btn>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Semester work % (owner)">
            <input
              className="hp-field"
              type="number"
              min={0}
              max={100}
              value={swPct}
              onChange={(e) => setSwPct(e.target.value)}
              placeholder="empty"
            />
          </Field>
          <Field label="Final exam % (owner)">
            <input
              className="hp-field"
              type="number"
              min={0}
              max={100}
              value={fePct}
              onChange={(e) => setFePct(e.target.value)}
              placeholder="empty"
            />
          </Field>
          <div className="flex items-end text-xs text-[var(--hp-muted)]">
            What-if only · confirm per-course scheme on VULMS
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHead
          title="Weekly Review & discipline"
          subtitle={`Week ${weekly.weekStart} → ${weekly.weekEnd} · logged Focus + owner checks only`}
        />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Focus minutes" value={`${weekly.focusMinutes}`} hint={`${weekly.sessionCount} sessions`} accent="teal" />
          <Stat
            label="Discipline hits"
            value={`${weekly.disciplineDoneThisWeek}/${weekly.disciplineTotal}`}
            hint="Checks touched this week"
            accent="violet"
          />
          <Stat label="Prep done" value={`${weekly.prepDoneCount}`} hint="≠ submitted" accent="blue" />
          <Stat
            label="Submitted / open"
            value={`${weekly.submittedCount} / ${weekly.openGradedCount}`}
            hint="Graded AQG only"
            accent="amber"
          />
        </div>
        <div className="grid gap-3">
          <Field label="Wins this week">
            <textarea
              className="hp-field min-h-[72px] py-2"
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              placeholder="Verified submits, handout coverage…"
            />
          </Field>
          <Field label="Blockers">
            <textarea
              className="hp-field min-h-[72px] py-2"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="What slipped — no invented excuses needed"
            />
          </Field>
          <Field label="Next week focus">
            <textarea
              className="hp-field min-h-[72px] py-2"
              value={nextFocus}
              onChange={(e) => setNextFocus(e.target.value)}
              placeholder="1–3 finishable targets"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Btn
              onClick={() => {
                upsertWeeklyReview({
                  weekStart,
                  wins,
                  blockers,
                  nextFocus,
                  updatedAt: Date.now(),
                });
                toggleDiscipline("weekly-review");
              }}
            >
              Save weekly review
            </Btn>
            <Btn variant="ghost" onClick={() => toggleDiscipline("mistake-review")}>
              Mark mistake-review check
            </Btn>
            <Btn variant="ghost" onClick={() => toggleDiscipline("past-paper-block")}>
              Mark past-paper check
            </Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}
