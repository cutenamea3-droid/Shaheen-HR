import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addCalendarDays, calendarDate } from "@/lib/plan-dates";
import {
  collectCalendarEvents,
  eventsInRange,
  eventsOnDay,
  isSameMonth,
  isToday,
  monthGrid,
  monthLabel,
  weekDays,
  weekLabel,
  type CalendarEvent,
  type CalendarView,
} from "@/lib/plan-calendar";
import { useData } from "@/lib/store";
import { Chip } from "./cells";
import { fmtDate } from "@/lib/alerts";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "list", label: "List" },
];

function EventRow({ ev }: { ev: CalendarEvent }) {
  return (
    <Link
      to="/s/$sectionId"
      params={{ sectionId: ev.sectionId }}
      search={{ row: ev.rowId }}
      className="block rounded-lg border border-transparent bg-muted/50 px-2 py-1.5 text-left hover:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={ev.tone} className="text-[10px]">
          {ev.kind === "follow_up"
            ? "Follow-up"
            : ev.kind === "suggestion"
              ? "Suggestion"
              : ev.kind === "derived"
                ? "Derived"
                : "Plan"}
        </Chip>
        <span className="text-sm font-bold">{ev.driver}</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{ev.title}</div>
      <div className="truncate text-xs text-muted-foreground">{ev.detail}</div>
    </Link>
  );
}

export function PlanCalendar() {
  const data = useData();
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => {
    const t = new Date();
    return calendarDate(t.getFullYear(), t.getMonth(), t.getDate());
  });

  const events = useMemo(() => collectCalendarEvents(data), [data]);

  const listEvents = useMemo(() => {
    if (view === "week") {
      const days = weekDays(anchor);
      return eventsInRange(events, days[0]!, days[6]!);
    }
    if (view === "month") {
      const start = calendarDate(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = calendarDate(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return eventsInRange(events, start, end);
    }
    // list: next 90 days + overdue
    const start = addCalendarDays(anchor, -30);
    const end = addCalendarDays(anchor, 90);
    return eventsInRange(events, start, end);
  }, [events, view, anchor]);

  function shift(dir: -1 | 1) {
    if (view === "week") {
      setAnchor((a) => addCalendarDays(a, dir * 7));
      return;
    }
    if (view === "month") {
      setAnchor((a) => calendarDate(a.getFullYear(), a.getMonth() + dir, 1));
      return;
    }
    setAnchor((a) => addCalendarDays(a, dir * 14));
  }

  return (
    <div className="space-y-4 text-[15px]">
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold">Intelligent Future Plan Calendar</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Saved plans, reminder suggestions (expiry − lead), and follow-up due dates. Applied
              statuses never get re-apply suggestions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Calendar view">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  "ui-press rounded-lg border-2 px-3 py-1.5 text-sm font-bold",
                  view === v.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/60",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-lg border-2 border-border p-2 hover:border-primary"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setAnchor(calendarDate(t.getFullYear(), t.getMonth(), t.getDate()));
            }}
            className="rounded-lg border-2 border-border px-3 py-1.5 text-sm font-bold hover:border-primary"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-lg border-2 border-border p-2 hover:border-primary"
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="ml-2 font-display text-base font-extrabold">
            {view === "week" ? weekLabel(anchor) : monthLabel(anchor)}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {listEvents.length} event{listEvents.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {view === "month" && (
        <div className="overflow-x-auto rounded-xl border-2 border-border bg-card">
          <div className="grid min-w-[720px] grid-cols-7 border-b bg-muted/40 text-center text-xs font-bold tracking-wide uppercase">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid min-w-[720px] grid-cols-7">
            {monthGrid(anchor).map((day) => {
              const dayEvents = eventsOnDay(events, day);
              const inMonth = isSameMonth(day, anchor);
              return (
                <div
                  key={toKey(day)}
                  className={cn(
                    "min-h-[96px] border-r border-b p-1.5",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                    isToday(day) && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 text-xs font-bold",
                      isToday(day) && "text-primary",
                    )}
                  >
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <EventRow key={ev.key} ev={ev} />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[11px] font-bold text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays(anchor).map((day) => {
            const dayEvents = eventsOnDay(events, day);
            return (
              <div
                key={toKey(day)}
                className={cn(
                  "rounded-xl border-2 border-border bg-card p-2",
                  isToday(day) && "border-primary",
                )}
              >
                <div className="mb-2 text-center">
                  <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="font-display text-xl font-extrabold">{day.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {!dayEvents.length && (
                    <p className="text-center text-xs text-muted-foreground">—</p>
                  )}
                  {dayEvents.map((ev) => (
                    <EventRow key={ev.key} ev={ev} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div className="space-y-2">
          {!listEvents.length ? (
            <p className="rounded-xl border bg-muted/40 px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
              No calendar events in this range.
            </p>
          ) : (
            listEvents.map((ev) => (
              <div
                key={ev.key}
                className="flex flex-wrap items-start gap-3 rounded-xl border-2 border-border bg-card p-3"
              >
                <div className="w-24 shrink-0 text-center">
                  <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {ev.date.toLocaleDateString("en-US", { month: "short" })}
                  </div>
                  <div className="font-display text-2xl font-extrabold">{ev.date.getDate()}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    {fmtDate(ev.date)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <EventRow ev={ev} />
                  {ev.overdue && (
                    <p className="mt-1 text-xs font-bold text-danger">Overdue</p>
                  )}
                  {ev.suggested && (
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Suggestion only — Apply from the work center or section editor to save.
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
