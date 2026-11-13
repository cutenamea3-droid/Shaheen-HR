import { describe, expect, test } from "vitest";
import { buildSeed, type Row } from "@/lib/sections";
import {
  collectCalendarEvents,
  eventsOnDay,
  monthGrid,
  weekDays,
} from "@/lib/plan-calendar";
import { ensureFollowUpSection } from "@/lib/follow-ups";
import { addFollowUp, getData } from "@/lib/store";
import { calendarDate, toISODateLocal } from "@/lib/plan-dates";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  return {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
  };
}

function iso(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return toISODateLocal(d);
}

describe("intelligent future plan calendar", () => {
  test("month grid is 42 cells; week is 7 days Sunday-start", () => {
    const anchor = calendarDate(2026, 10, 13); // Fri Nov 13 2026
    expect(monthGrid(anchor)).toHaveLength(42);
    const week = weekDays(anchor);
    expect(week).toHaveLength(7);
    expect(week[0]!.getDay()).toBe(0);
  });

  test("collects follow-up dues and suppresses Applied re-apply suggestions", () => {
    addFollowUp({
      driverId: "d_fu",
      driver: "FU Driver",
      subject: "Check CDL paperwork",
      dueDate: iso(3),
      source: "manual",
      sectionId: "ssccdl",
    });

    const events = collectCalendarEvents(ensureFollowUpSection(getData()));
    expect(events.some((e) => e.kind === "follow_up" && e.driver === "FU Driver")).toBe(true);

    // Applied suppresses re-apply suggestions on calendar
    const appliedData = ensureFollowUpSection(buildSeed());
    for (const id of ["medical", "queries", "ssccdl", "docs", "info"] as const) {
      appliedData.sections[id].rows = [];
    }
    appliedData.sections.dmv.rows = [
      row({
        id: "dmv_a",
        driverId: "d_a",
        // name, text, status, date, text, note, active, plan, state, tempnote
        cells: ["Applied Cal", "", "Applied", iso(40), "", "", "Active", "", "CA", ""],
      }),
    ];
    const appliedEvents = collectCalendarEvents(appliedData);
    expect(
      appliedEvents.some(
        (e) => e.kind === "suggestion" && e.driver === "Applied Cal" && /DMV/i.test(e.title),
      ),
    ).toBe(false);
  });

  test("eventsOnDay filters by local calendar date", () => {
    addFollowUp({
      driverId: "d_day",
      driver: "Day Driver",
      subject: "Today item",
      dueDate: iso(0),
      source: "manual",
    });
    const events = collectCalendarEvents(getData());
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const todayEvents = eventsOnDay(events, t);
    expect(todayEvents.some((e) => e.driver === "Day Driver")).toBe(true);
  });
});
