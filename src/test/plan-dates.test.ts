import { describe, expect, test } from "vitest";
import {
  PLAN_LEAD_RULES,
  SUGGESTION_UNAVAILABLE,
  addCalendarDays,
  buildFuturePlanSuggestion,
  computeReminderDate,
  formatSuggestionDate,
  planRuleFor,
  suggestPlanForCell,
  toISODateLocal,
} from "@/lib/plan-dates";
import { suggestApplyPlan, daysUntil, parseISO } from "@/lib/alerts";
import type { Row } from "@/lib/sections";

function row(cells: string[], extra?: Partial<Row>): Row {
  return { id: "r1", driverId: "d1", cells, ...extra };
}

describe("plan lead rules from existing code", () => {
  test("Annual Query and Pre-Emp are 14d; CDL is 30d (not 13)", () => {
    const annual = planRuleFor("queries", 6)!;
    const pre = planRuleFor("queries", 7)!;
    const cdl = planRuleFor("ssccdl", 7)!;
    const med = planRuleFor("medical", 6)!;
    expect(annual.leadDays).toBe(14);
    expect(pre.leadDays).toBe(14);
    expect(cdl.leadDays).toBe(30);
    expect(med.leadDays).toBe(17);
    expect(PLAN_LEAD_RULES.map((r) => r.sectionId + ":" + r.planCol)).toEqual([
      "dmv:7",
      "medical:6",
      "queries:6",
      "queries:7",
      "ssccdl:7",
    ]);
  });

  test("DMV lead follows dmvDays CA=10 / other=20", () => {
    const rule = planRuleFor("dmv", 7)!;
    expect(typeof rule.leadDays).toBe("function");
    const ca = row(["A", "", "Valid", "2027-05-07", "", "", "Active", "", "CA", ""]);
    const tx = row(["A", "", "Valid", "2027-05-07", "", "", "Active", "", "TX", ""]);
    expect((rule.leadDays as (r: Row) => number)(ca)).toBe(10);
    expect((rule.leadDays as (r: Row) => number)(tx)).toBe(20);
  });
});

describe("calendar date arithmetic", () => {
  test("month end and leap year", () => {
    const mar1 = parseISO("2027-03-01")!;
    expect(toISODateLocal(addCalendarDays(mar1, -1))).toBe("2027-02-28");
    const mar1Leap = parseISO("2028-03-01")!;
    expect(toISODateLocal(addCalendarDays(mar1Leap, -1))).toBe("2028-02-29");
    const jan1 = parseISO("2027-01-01")!;
    expect(toISODateLocal(addCalendarDays(jan1, -1))).toBe("2026-12-31");
  });

  test("verified calendar dates for every lead rule", () => {
    // Expiry 2027-05-07 (Friday)
    const expiry = "2027-05-07";
    const cases: { sectionId: string; planCol: number; cells: string[]; expectISO: string; lead: number }[] = [
      {
        sectionId: "queries",
        planCol: 6,
        cells: ["D", "Valid", expiry, "Valid", "2099-01-01", "", "", "", "Active", ""],
        expectISO: "2027-04-23", // −14
        lead: 14,
      },
      {
        sectionId: "queries",
        planCol: 7,
        cells: ["D", "Valid", "2099-01-01", "Valid", expiry, "", "", "", "Active", ""],
        expectISO: "2027-04-23",
        lead: 14,
      },
      {
        sectionId: "ssccdl",
        planCol: 7,
        cells: ["D", "", "Valid", expiry, "Valid", "", "", "", "Active", ""],
        expectISO: "2027-04-07", // −30
        lead: 30,
      },
      {
        sectionId: "medical",
        planCol: 6,
        cells: ["D", "Valid", expiry, "", "", "Active", "", ""],
        expectISO: "2027-04-20", // −17
        lead: 17,
      },
      {
        sectionId: "dmv",
        planCol: 7,
        cells: ["D", "", "Valid", expiry, "NONE", "", "Active", "", "CA", ""],
        expectISO: "2027-04-27", // −10 CA
        lead: 10,
      },
      {
        sectionId: "dmv",
        planCol: 7,
        cells: ["D", "", "Valid", expiry, "NONE", "", "Active", "", "TX", ""],
        expectISO: "2027-04-17", // −20
        lead: 20,
      },
    ];

    for (const c of cases) {
      const r = row(c.cells);
      const s = suggestPlanForCell(c.sectionId, c.planCol, r)!;
      expect(s.available).toBe(true);
      expect(s.leadDays).toBe(c.lead);
      expect(s.reminderISO).toBe(c.expectISO);
      expect(s.expiryISO).toBe(expiry);
      // Future Plan suggestion date === Smart Alert action date (single subtraction)
      const again = computeReminderDate(parseISO(expiry)!, c.lead);
      expect(toISODateLocal(again)).toBe(c.expectISO);
      expect(s.reminderISO).toBe(toISODateLocal(again));
    }
  });

  test("suggestApplyPlan bare API stays expiry−14 for queries-style", () => {
    expect(suggestApplyPlan("2027-05-07")).toBe("I will Apply on April 23 (Friday), 2027");
    expect(formatSuggestionDate(computeReminderDate(parseISO("2027-05-07")!, 14))).toBe(
      "April 23 (Friday), 2027",
    );
  });
});

describe("suggestion safety", () => {
  test("missing / invalid / Old → unavailable message", () => {
    const rule = planRuleFor("queries", 6)!;
    for (const exp of ["", "Missing", " Old", "not-a-date"]) {
      const s = buildFuturePlanSuggestion(rule, row(["D", "Valid", exp, "", "", "", "", "", "Active", ""]));
      expect(s.available).toBe(false);
      expect(s.text).toBe(SUGGESTION_UNAVAILABLE);
    }
  });

  test("Applied suppresses re-apply suggestion", () => {
    const rule = planRuleFor("dmv", 7)!;
    const s = buildFuturePlanSuggestion(
      rule,
      row(["D", "", "Applied", "2027-05-07", "NONE", "", "Active", "manual plan keep", "CA", ""]),
    );
    expect(s.suppressReapply).toBe(true);
    expect(s.available).toBe(false);
    expect(s.text.toLowerCase()).toMatch(/application|status/);
  });

  test("manual plan text is not overwritten by suggestion builder", () => {
    const rule = planRuleFor("medical", 6)!;
    const cells = ["D", "Valid", "2027-05-07", "", "", "Active", "Call on Monday — custom", ""];
    const s = buildFuturePlanSuggestion(rule, row(cells));
    expect(s.available).toBe(true);
    expect(cells[6]).toBe("Call on Monday — custom");
    expect(s.text).not.toBe(cells[6]);
  });

  test("passing precomputed reminder does not subtract lead again", () => {
    const rule = planRuleFor("queries", 6)!;
    const expiry = parseISO("2027-05-07")!;
    const reminder = computeReminderDate(expiry, 14);
    const s = buildFuturePlanSuggestion(rule, row(["D", "Valid", "2027-05-07", "", "", "", "", "", "Active", ""]), {
      reminderDate: reminder,
    });
    expect(s.reminderISO).toBe("2027-04-23");
    // If lead were subtracted again → 2027-04-09
    expect(s.reminderISO).not.toBe("2027-04-09");
  });

  test("past reminder is marked overdue", () => {
    const rule = planRuleFor("queries", 6)!;
    // Expiry far in the past → reminder also past
    const s = buildFuturePlanSuggestion(rule, row(["D", "Valid", "2020-01-15", "", "", "", "", "", "Active", ""]));
    expect(s.available).toBe(true);
    expect(s.overdue).toBe(true);
    expect(s.overdueDays).toBeGreaterThan(0);
    expect(daysUntil(s.reminderDate!)).toBeLessThan(0);
  });
});
