/**
 * Intelligent Future Plan Calendar — month / week / list event model.
 * Combines saved Future Plans, derived DMV apply dates, reminder suggestions,
 * and durable follow-up due dates. Calendar-date only (no UTC day-shift).
 */
import {
  collectPlans,
  daysUntil,
  fmtDate,
  parseISO,
  today,
  type Tone,
} from "./alerts";
import {
  addCalendarDays,
  buildFuturePlanSuggestion,
  calendarDate,
  PLAN_LEAD_RULES,
  toISODateLocal,
} from "./plan-dates";
import { listFollowUps, followUpTone, type FollowUp } from "./follow-ups";
import { SECTIONS, type AppData } from "./sections";
import { rowIsActive, rowOrdinaryComplianceMuted } from "./alerts";

function startOfDay(d: Date): Date {
  return calendarDate(d.getFullYear(), d.getMonth(), d.getDate());
}

export type CalendarView = "month" | "week" | "list";

export type CalendarEventKind = "plan" | "suggestion" | "follow_up" | "derived";

export type CalendarEvent = {
  key: string;
  date: Date;
  dateIso: string;
  kind: CalendarEventKind;
  tone: Tone;
  driver: string;
  driverId: string;
  title: string;
  detail: string;
  sectionId: string;
  rowId: string;
  /** True when event is a suggestion not yet written to Future Plan. */
  suggested: boolean;
  overdue: boolean;
};

function toIso(d: Date): string {
  return toISODateLocal(d);
}

function toneForDate(d: Date): Tone {
  const n = daysUntil(d);
  if (n < 0) return "danger";
  if (n === 0) return "warn";
  if (n <= 7) return "info";
  return "ok";
}

/** Build unified calendar events for the Intelligent Future Plan Calendar. */
export function collectCalendarEvents(data: AppData): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const seenSuggestionKeys = new Set<string>();

  // 1) Saved / derived plans from collectPlans
  for (const p of collectPlans(data)) {
    const iso = toIso(p.date);
    out.push({
      key: `plan:${p.sectionId}:${p.rowId}:${iso}:${p.derived ? "d" : "s"}`,
      date: startOfDay(p.date),
      dateIso: iso,
      kind: p.derived ? "derived" : "plan",
      tone: toneForDate(p.date),
      driver: p.driver,
      driverId: "",
      title: p.derived ? "Suggested DMV apply (from expiry)" : "Future Plan",
      detail: p.text,
      sectionId: p.sectionId,
      rowId: p.rowId,
      suggested: p.derived,
      overdue: daysUntil(p.date) < 0,
    });
  }

  // Fill driverId from section rows for plan events
  for (const ev of out) {
    if (ev.driverId) continue;
    const row = data.sections[ev.sectionId]?.rows.find((r) => r.id === ev.rowId);
    if (row) ev.driverId = row.driverId;
  }

  // 2) Intelligent suggestions (reminder = expiry − lead) when no saved plan date yet
  for (const rule of PLAN_LEAD_RULES) {
    const sec = data.sections[rule.sectionId];
    const def = SECTIONS.find((s) => s.id === rule.sectionId);
    if (!sec || !def) continue;
    for (const row of sec.rows) {
      if (rowOrdinaryComplianceMuted(def, row, data)) continue;
      if (!rowIsActive(def, row, data)) continue;
      const suggestion = buildFuturePlanSuggestion(rule, row);
      if (!suggestion.available || !suggestion.reminderDate) continue;
      // Skip if Applied (status-check only — preserve Applied DMV behavior)
      if (suggestion.suppressReapply) continue;
      const saved = (row.cells[rule.planCol] ?? "").trim();
      // If a saved plan already has a parseable date, collectPlans covers it
      if (saved) continue;
      const iso = toIso(suggestion.reminderDate);
      const key = `sug:${rule.sectionId}:${row.id}:${rule.planCol}:${iso}`;
      if (seenSuggestionKeys.has(key)) continue;
      seenSuggestionKeys.add(key);
      out.push({
        key,
        date: startOfDay(suggestion.reminderDate),
        dateIso: iso,
        kind: "suggestion",
        tone: toneForDate(suggestion.reminderDate),
        driver: row.cells[0] ?? "",
        driverId: row.driverId,
        title: `${rule.docLabel} reminder`,
        detail: suggestion.text,
        sectionId: rule.sectionId,
        rowId: row.id,
        suggested: true,
        overdue: daysUntil(suggestion.reminderDate) < 0,
      });
    }
  }

  // 3) Durable follow-ups with due dates
  for (const fu of listFollowUps(data)) {
    if (fu.status === "done") continue;
    const d = parseISO(fu.dueDate);
    if (!d) continue;
    out.push({
      key: `fu:${fu.id}`,
      date: startOfDay(d),
      dateIso: toIso(d),
      kind: "follow_up",
      tone: followUpTone(fu),
      driver: fu.driver,
      driverId: fu.driverId,
      title: fu.subject || "Follow-up",
      detail: fu.notes || fu.docType || "Compliance follow-up",
      sectionId: fu.sectionId || "dmv",
      rowId: fu.linkedRowId || fu.id,
      suggested: false,
      overdue: daysUntil(d) < 0,
    });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.driver.localeCompare(b.driver));
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const iso = toIso(startOfDay(day));
  return events.filter((e) => e.dateIso === iso);
}

export function eventsInRange(events: CalendarEvent[], start: Date, end: Date): CalendarEvent[] {
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return events.filter((e) => {
    const t = e.date.getTime();
    return t >= a && t <= b;
  });
}

/** Sunday-start month grid cells (includes leading/trailing days). */
export function monthGrid(anchor: Date): Date[] {
  const first = calendarDate(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addCalendarDays(first, -first.getDay()); // back to Sunday
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addCalendarDays(start, i));
  return cells;
}

/** Week starting Sunday containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const d = startOfDay(anchor);
  const start = addCalendarDays(d, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
}

export function monthLabel(anchor: Date): string {
  return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function weekLabel(anchor: Date): string {
  const days = weekDays(anchor);
  const a = days[0]!;
  const b = days[6]!;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(d: Date): boolean {
  return toIso(startOfDay(d)) === toIso(today());
}

export type FollowUpForCalendar = FollowUp;
