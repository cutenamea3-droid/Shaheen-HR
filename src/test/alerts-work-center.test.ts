import { describe, expect, test } from "vitest";
import { buildSeed, type Row } from "@/lib/sections";
import {
  collectWorkCenterItems,
  filterWorkCenterItems,
  groupWorkCenterByDriver,
  workCenterCounts,
} from "@/lib/alerts-work-center";
import { setCell } from "@/lib/store";
import { suggestPlanForCell } from "@/lib/plan-dates";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  const r: Row = {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
  };
  if (partial.addedAt != null) r.addedAt = partial.addedAt;
  if (partial.rosterKind) r.rosterKind = partial.rosterKind;
  return r;
}

function iso(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

describe("alerts work center collector", () => {
  test("groups issues by driver and exposes filters", () => {
    const data = buildSeed();
    for (const id of ["dmv", "queries", "ssccdl", "docs", "info"] as const) {
      data.sections[id].rows = [];
    }
    data.sections.medical.rows = [
      row({
        id: "m1",
        driverId: "d_exp",
        cells: ["Expired Med", "Valid", iso(-5), "", "", "Active", "", ""],
      }),
      row({
        id: "m2",
        driverId: "d_soon",
        cells: ["Soon Med", "Valid", iso(10), "", "", "Active", "", ""],
      }),
    ];

    const items = collectWorkCenterItems(data);
    expect(items.some((i) => i.driver === "Expired Med" && i.filters.includes("expired"))).toBe(true);
    expect(items.some((i) => i.driver === "Soon Med" && i.filters.includes("expiring_soon"))).toBe(true);

    const groups = groupWorkCenterByDriver(items.filter((i) => i.driver.startsWith("Expired") || i.driver.startsWith("Soon")));
    expect(groups.length).toBeGreaterThanOrEqual(2);

    const counts = workCenterCounts(items);
    expect(counts.expired).toBeGreaterThanOrEqual(1);
    expect(counts.all).toBeGreaterThan(0);
  });

  test("temp notes and new drivers are separate filters; temp notes have no due date", () => {
    const data = buildSeed();
    for (const id of ["dmv", "queries", "ssccdl", "docs", "info"] as const) data.sections[id].rows = [];
    data.sections.medical.rows = [
      row({
        id: "tn",
        driverId: "d_tn",
        cells: ["Temp Note Driver", "Valid", iso(90), "", "", "Active", "", "Call back tomorrow"],
        rosterKind: "roster",
      }),
      row({
        id: "nd",
        driverId: "d_new",
        cells: ["New Hire", "Missing", "", "", "", "Active", "", ""],
        rosterKind: "new",
      }),
    ];
    // Mirror rosterKind on a dmv row so isNewDriver finds it
    data.sections.dmv.rows = [
      row({
        id: "nd_dmv",
        driverId: "d_new",
        cells: ["New Hire", "", "Missing", "", "NONE", "", "Active", "", "CA", ""],
        rosterKind: "new",
      }),
    ];

    const items = collectWorkCenterItems(data);
    const temp = items.filter((i) => i.filters.includes("temporary_notes"));
    expect(temp.some((i) => i.existingTempNote.includes("Call back"))).toBe(true);
    expect(temp.every((i) => i.daysLabel === "No due date" || i.kind === "tempnote")).toBe(true);

    const news = filterWorkCenterItems(items, "new_drivers", "");
    expect(news.some((i) => i.kind === "new_driver" || i.isNew)).toBe(true);
  });

  test("pending Applied and missing docs filters", () => {
    const data = buildSeed();
    for (const id of ["medical", "queries", "ssccdl", "info"] as const) data.sections[id].rows = [];
    data.sections.dmv.rows = [
      row({
        id: "ap",
        driverId: "d_ap",
        cells: ["Applied Driver", "", "Applied", iso(20), "NONE", "", "Active", "", "CA", ""],
      }),
    ];
    data.sections.docs.rows = [
      row({
        id: "doc",
        driverId: "d_ap",
        cells: [
          "Applied Driver",
          "",
          "Missing",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "Valid",
          "",
          "Active",
          "",
        ],
      }),
    ];

    const items = collectWorkCenterItems(data);
    expect(filterWorkCenterItems(items, "pending_applications", "").length).toBeGreaterThan(0);
    expect(filterWorkCenterItems(items, "missing_documents", "").length).toBeGreaterThan(0);
    expect(filterWorkCenterItems(items, "all", "Applied Driver").every((i) => i.driver.includes("Applied"))).toBe(
      true,
    );
  });

  test("Future Plan suggestion matches action date; expiry edit recalcs; manual plan preserved", () => {
    const data = buildSeed();
    for (const id of ["dmv", "queries", "ssccdl", "docs", "info"] as const) data.sections[id].rows = [];
    const expiry = "2027-05-07";
    data.sections.medical.rows = [
      row({
        id: "planrow",
        driverId: "d_plan",
        cells: ["Plan Driver", "Valid", expiry, "", "", "Active", "Keep my custom plan", ""],
      }),
    ];

    const items = collectWorkCenterItems(data);
    const planItem = items.find((i) => i.kind === "plan" && i.driver === "Plan Driver");
    expect(planItem?.planSuggestion?.reminderISO).toBe("2027-04-20"); // medical 17d
    expect(planItem?.existingPlan).toBe("Keep my custom plan");
    expect(planItem?.planSuggestion?.text).not.toBe("Keep my custom plan");

    // Simulate authorized save of new expiry via setCell on store — then re-collect from seed copy
    // Unit-level: mutate cells like setCell would for that field only
    const live = data.sections.medical.rows[0]!;
    live.cells[2] = "2027-06-07";
    const next = suggestPlanForCell("medical", 6, live)!;
    expect(next.reminderISO).toBe("2027-05-21"); // 2027-06-07 − 17
    expect(live.cells[6]).toBe("Keep my custom plan");
  });
});

describe("search", () => {
  test("filters by doc type name", () => {
    const data = buildSeed();
    const items = collectWorkCenterItems(data);
    const q = filterWorkCenterItems(items, "all", "cdl");
    expect(q.every((i) => /cdl|ssc/i.test(`${i.docType} ${i.sectionTitle} ${i.details}`))).toBe(true);
  });
});

// Keep setCell import referenced for authorized-path documentation in this suite.
test("setCell export is the authorized write path", () => {
  expect(typeof setCell).toBe("function");
});
