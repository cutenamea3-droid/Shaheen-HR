import { useEffect, useState, type ReactNode } from "react";
import { Bell, BellOff } from "lucide-react";
import { Btn } from "./common";
import {
  VU_STUDY_PLAN,
  dueSoonTodos,
  feeTodos,
  overdueTodos,
  type VuTodo,
} from "@/personal/lib/vu-plan";
import { todayKey } from "@/personal/lib/store";

function daysUntil(due: string, today: string): number {
  const a = new Date(`${today}T12:00:00`).getTime();
  const b = new Date(`${due}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function AlertStrip() {
  const today = todayKey();
  const overdue = overdueTodos(VU_STUDY_PLAN, today);
  const soon48 = dueSoonTodos(VU_STUDY_PLAN, today, 2);
  const assign72 = dueSoonTodos(VU_STUDY_PLAN, today, 3).filter((t) => t.kind === "assignment");
  const fees = feeTodos(VU_STUDY_PLAN).filter((t) => t.due && t.due >= today);
  const cs101 = VU_STUDY_PLAN.progressTimeline.courses.CS101 as {
    attendance?: { absentPct?: number | null } | null;
  };
  const absentWeeks = VU_STUDY_PLAN.recovery.cs101ProgressCatchUp?.absentWeeksVisible ?? 0;

  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
  }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      const top = overdue[0] || soon48[0];
      if (top) {
        new Notification("HR Personal · To-Do Calendar", {
          body: overdue.length
            ? `${overdue.length} window(s) ended — verify on VULMS. ${top.title}`
            : `Closing soon: ${top.title} (${top.due})`,
          tag: "hp-vu-alert",
        });
      }
    }
  };

  const hasAny =
    overdue.length > 0 || soon48.length > 0 || assign72.length > 0 || fees.length > 0 || absentWeeks >= 2;

  if (!hasAny) {
    return (
      <div className="hp-alert-calm hp-fade-up flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--hp-teal)]/30 bg-[color-mix(in_srgb,var(--hp-teal)_10%,transparent)] px-3 py-2.5">
        <p className="text-sm font-semibold text-[var(--hp-ink)]">
          To-Do Calendar looks clear for urgent graded windows. Keep Handouts + Lecture Schedule.
        </p>
        <NotifyBtn perm={perm} onClick={enableNotifications} />
      </div>
    );
  }

  return (
    <div className="space-y-2 hp-fade-up">
      {overdue.length ? (
        <Banner
          tone="overdue"
          title={`Verify on VULMS · To-Do Calendar window ended (${overdue.length})`}
          trailing={<NotifyBtn perm={perm} onClick={enableNotifications} />}
          footnote="Export does not prove a miss — mark done here after you confirm attempt/submit on VULMS."
        >
          {overdue.slice(0, 4).map((t) => (
            <AlertRow key={`${t.courseCode}-${t.title}`} todo={t} today={today} tone="overdue" />
          ))}
        </Banner>
      ) : null}

      {soon48.length ? (
        <Banner
          tone="soon"
          title={`Quiz / GDB / Assignment closing ≤48h (${soon48.length})`}
          trailing={!overdue.length ? <NotifyBtn perm={perm} onClick={enableNotifications} /> : null}
        >
          {soon48.slice(0, 5).map((t) => (
            <AlertRow key={`${t.courseCode}-${t.title}`} todo={t} today={today} tone="soon" />
          ))}
        </Banner>
      ) : null}

      {assign72.length && !soon48.some((s) => assign72.some((a) => a.title === s.title)) ? (
        <Banner tone="soon" title={`Assignment due ≤72h (${assign72.length})`}>
          {assign72.slice(0, 3).map((t) => (
            <AlertRow key={`a-${t.courseCode}-${t.title}`} todo={t} today={today} tone="soon" />
          ))}
        </Banner>
      ) : null}

      {absentWeeks >= 2 ? (
        <Banner
          tone="progress"
          title={`Progress Timeline · CS101 multi-week absence (${absentWeeks} weeks)`}
          footnote={
            cs101?.attendance?.absentPct != null
              ? `Attendance pie Absent ${cs101.attendance.absentPct}% · other courses’ Progress Timeline not in this export.`
              : "Other courses’ Progress Timeline not in this export — re-save after opening each tab."
          }
        >
          <li className="text-sm font-semibold text-[var(--hp-ink)]">
            Prefer Handouts-first catch-up for CS101 before full lecture binge.
          </li>
        </Banner>
      ) : null}

      {fees.length ? (
        <Banner tone="fee" title={`Fee challan on To-Do Calendar (${fees.length}) — admin, not study`}>
          {fees.slice(0, 3).map((t) => (
            <li key={t.title} className="flex justify-between gap-3 text-sm">
              <span className="font-semibold">{t.title}</span>
              <span className="text-xs font-bold tabular-nums text-[var(--hp-muted)]">{t.due}</span>
            </li>
          ))}
        </Banner>
      ) : null}
    </div>
  );
}

function Banner({
  tone,
  title,
  trailing,
  footnote,
  children,
}: {
  tone: "overdue" | "soon" | "progress" | "fee";
  title: string;
  trailing?: ReactNode;
  footnote?: string;
  children: ReactNode;
}) {
  const cls =
    tone === "overdue"
      ? "hp-alert-overdue border-[#f87171]/40 bg-[color-mix(in_srgb,#ef4444_14%,transparent)]"
      : tone === "soon"
        ? "border-[var(--hp-amber)]/40 bg-[color-mix(in_srgb,var(--hp-amber)_12%,transparent)]"
        : tone === "progress"
          ? "border-[var(--hp-violet)]/35 bg-[color-mix(in_srgb,var(--hp-violet)_10%,transparent)]"
          : "border-[var(--hp-blue)]/35 bg-[color-mix(in_srgb,var(--hp-blue)_10%,transparent)]";
  const titleCls =
    tone === "overdue"
      ? "text-[#fca5a5]"
      : tone === "soon"
        ? "text-[var(--hp-amber)]"
        : tone === "progress"
          ? "text-[var(--hp-violet-soft)]"
          : "text-[var(--hp-blue-bright)]";
  return (
    <div className={`rounded-xl border px-3 py-3 ${cls}`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${titleCls}`}>{title}</div>
        {trailing}
      </div>
      <ul className="space-y-1">{children}</ul>
      {footnote ? <p className="mt-2 text-[11px] text-[var(--hp-muted)]">{footnote}</p> : null}
    </div>
  );
}

function AlertRow({
  todo,
  today,
  tone,
}: {
  todo: VuTodo;
  today: string;
  tone: "overdue" | "soon";
}) {
  const d = todo.due ? daysUntil(todo.due, today) : null;
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="font-semibold text-[var(--hp-ink)]">
        <span className="text-[var(--hp-muted)]">{todo.courseCode}</span> · {todo.title}
      </span>
      <span
        className={`shrink-0 text-xs font-bold tabular-nums ${
          tone === "overdue" ? "text-[#fca5a5]" : "text-[var(--hp-amber)]"
        }`}
      >
        {todo.due}
        {d != null ? (d < 0 ? ` · ${Math.abs(d)}d past` : d === 0 ? " · today" : ` · ${d}d`) : ""}
      </span>
    </li>
  );
}

function NotifyBtn({
  perm,
  onClick,
}: {
  perm: NotificationPermission | "unsupported";
  onClick: () => void;
}) {
  if (perm === "unsupported") return null;
  if (perm === "granted") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hp-teal)]">
        <Bell className="h-3.5 w-3.5" /> Alerts on
      </span>
    );
  }
  return (
    <Btn variant="ghost" className="!py-1 !text-[11px]" onClick={onClick}>
      {perm === "denied" ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {perm === "denied" ? "Blocked in browser" : "Enable browser alerts"}
    </Btn>
  );
}
