import { describe, expect, test } from "vitest";
import { analyzeRow, daysUntil, parseISO } from "@/lib/alerts";
import {
  PLAN_LEAD_RULES,
  computeFuturePlanHighlight,
  futurePlanHighlightForCell,
  planRuleFor,
  suggestPlanForCell,
  toISODateLocal,
  addCalendarDays,
} from "@/lib/plan-dates";
import { SECTIONS, type Row } from "@/lib/sections";

function row(cells: string[], extra?: Partial<Row>): Row {
  return { id: "r1", driverId: "d1", cells, ...extra };
}

/** Local ISO date N calendar days from today. */
function isoFromToday(deltaDays: number): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return toISODateLocal(addCalendarDays(t, deltaDays));
}

describe("future plan highlight — section lead rules", () => {
  test("reuses existing leads (no global / no invented 13 for CDL or Clearinghouse)", () => {
    expect(planRuleFor("queries", 6)!.leadDays).toBe(14); // Annual Query
    expect(planRuleFor("queries", 7)!.leadDays).toBe(14); // Pre-Emp (Clearinghouse pair)
    expect(planRuleFor("ssccdl", 7)!.leadDays).toBe(30); // CDL — not 13
    expect(planRuleFor("medical", 6)!.leadDays).toBe(17);
    const dmv = planRuleFor("dmv", 7)!;
    expect(typeof dmv.leadDays).toBe("function");
    // Other Documents has no plan rule
    expect(PLAN_LEAD_RULES.some((r) => r.sectionId === "docs")).toBe(false);
  });

  test("empty plan + far expiry → not actionable, no analyzeRow plan issue", () => {
    const cells = ["D", "Valid", isoFromToday(200), "", "", "Active", "", ""];
    const r = row(cells);
    const h = futurePlanHighlightForCell("medical", 6, r)!;
    expect(h.actionable).toBe(false);
    const def = SECTIONS.find((s) => s.id === "medical")!;
    const { issues, cellTone } = analyzeRow(def, def.types.map((_, i) => `h${i}`), r);
    expect(issues.some((i) => i.col === 6)).toBe(false);
    expect(cellTone[6]).toBeUndefined();
  });

  test("empty plan + reminder due → suggestion actionable; saved plan still not an analyzeRow issue", () => {
    // Medical lead 17: expiry in 10d → reminder overdue/due
    const expiry = isoFromToday(10);
    const cells = ["D", "Valid", expiry, "", "", "Active", "", ""];
    const r = row(cells);
    const h = futurePlanHighlightForCell("medical", 6, r)!;
    expect(h.actionable).toBe(true);
    expect(h.suggestionTone).toBeTruthy();
    const def = SECTIONS.find((s) => s.id === "medical")!;
    const { issues, cellTone } = analyzeRow(def, def.types.map((_, i) => `h${i}`), r);
    expect(issues.some((i) => /future plan/i.test(i.label))).toBe(false);
    expect(cellTone[6]).toBeUndefined(); // empty saved plan stays neutral in cellTone
  });

  test("reminder not due yet (inside calendar but before lead window) → not actionable", () => {
    // Annual lead 14: expiry in 40d → reminder in 26d
    const r = row(["D", "Valid", isoFromToday(40), "Valid", "2099-01-01", "", "", "", "Active", ""]);
    const h = futurePlanHighlightForCell("queries", 6, r)!;
    expect(h.actionable).toBe(false);
    expect(h.reason).toMatch(/not due/i);
  });

  test("reminder due today", () => {
    const annual = planRuleFor("queries", 6)!;
    const expiry = isoFromToday(14); // lead 14 → reminder = today
    const r = row(["D", "Valid", expiry, "Valid", "2099-01-01", "", "saved plan text", "", "Active", ""]);
    const h = computeFuturePlanHighlight(annual, r);
    expect(h.actionable).toBe(true);
    expect(h.daysToReminder).toBe(0);
    expect(h.suggestionTone).toBe("warn");
    // Writing a manual plan ≠ completed
    expect(r.cells[6]).toBe("saved plan text");
    expect(h.actionable).toBe(true);
  });

  test("overdue reminder before expiry → danger cue", () => {
    const r = row(["D", "Valid", isoFromToday(3), "Valid", "2099-01-01", "", "", "", "Active", ""]);
    const h = futurePlanHighlightForCell("queries", 6, r)!;
    expect(h.actionable).toBe(true);
    expect(h.daysToReminder!).toBeLessThan(0);
    expect(h.suggestionTone).toBe("danger");
  });

  test("expired document → NOT future plan highlight (separate compliance issue)", () => {
    const expiry = isoFromToday(-5);
    const r = row(["D", "", "Valid", expiry, "NONE", "", "Active", "old plan keep", "CA", ""]);
    const h = futurePlanHighlightForCell("dmv", 7, r)!;
    expect(h.actionable).toBe(false);
    expect(h.reason).toMatch(/expired/i);
    const def = SECTIONS.find((s) => s.id === "dmv")!;
    const { issues } = analyzeRow(def, def.types.map((_, i) => `h${i}`), r);
    expect(issues.some((i) => i.col === 3 && /expired/i.test(i.label))).toBe(true);
    expect(issues.some((i) => i.col === 7)).toBe(false);
    expect(r.cells[7]).toBe("old plan keep"); // history preserved
  });

  test("missing / invalid expiry → no reminder highlight", () => {
    for (const exp of ["", "Missing", "not-a-date", " Old"]) {
      const r = row(["D", "Valid", exp, "", "", "Active", "", ""]);
      const h = futurePlanHighlightForCell("medical", 6, r)!;
      expect(h.actionable).toBe(false);
      expect(h.suggestionTone).toBeNull();
    }
  });

  test("Applied suppresses reminder highlight (completed / in-progress path)", () => {
    const r = row(["D", "", "Applied", isoFromToday(5), "NONE", "", "Active", "I will Apply…", "CA", ""]);
    const h = futurePlanHighlightForCell("dmv", 7, r)!;
    expect(h.actionable).toBe(false);
    expect(h.reason).toMatch(/Applied/i);
    const s = suggestPlanForCell("dmv", 7, r)!;
    expect(s.suppressReapply).toBe(true);
  });

  test("DMV CA 10 / other 20 lead windows", () => {
    const ca = row(["D", "", "Valid", isoFromToday(8), "NONE", "", "Active", "", "CA", ""]);
    const tx = row(["D", "", "Valid", isoFromToday(8), "NONE", "", "Active", "", "TX", ""]);
    // CA lead 10 → 8d left is inside window
    expect(futurePlanHighlightForCell("dmv", 7, ca)!.actionable).toBe(true);
    // TX lead 20 → 8d left is inside window
    expect(futurePlanHighlightForCell("dmv", 7, tx)!.actionable).toBe(true);
    // CA: 15d left is outside 10d lead
    const caFar = row(["D", "", "Valid", isoFromToday(15), "NONE", "", "Active", "", "CA", ""]);
    expect(futurePlanHighlightForCell("dmv", 7, caFar)!.actionable).toBe(false);
    // TX: 15d left is inside 20d lead
    const txNear = row(["D", "", "Valid", isoFromToday(15), "NONE", "", "Active", "", "TX", ""]);
    expect(futurePlanHighlightForCell("dmv", 7, txNear)!.actionable).toBe(true);
  });

  test("CDL 30d and Medical 17d vs amber 15d", () => {
    // Medical: 16d left → plan actionable (17), but amber dateIssue uses 15 → no date warn
    const med = row(["D", "Valid", isoFromToday(16), "", "", "Active", "", ""]);
    expect(futurePlanHighlightForCell("medical", 6, med)!.actionable).toBe(true);
    const medDef = SECTIONS.find((s) => s.id === "medical")!;
    const medIssues = analyzeRow(medDef, medDef.types.map((_, i) => `h${i}`), med).issues;
    expect(medIssues.some((i) => i.col === 2)).toBe(false); // outside 15d amber
    expect(medIssues.some((i) => i.col === 6)).toBe(false);

    // CDL: 25d left → actionable under 30
    const cdl = row(["D", "", "Valid", isoFromToday(25), "Valid", "", "", "", "Active", ""]);
    expect(futurePlanHighlightForCell("ssccdl", 7, cdl)!.actionable).toBe(true);
    const far = row(["D", "", "Valid", isoFromToday(45), "Valid", "", "", "", "Active", ""]);
    expect(futurePlanHighlightForCell("ssccdl", 7, far)!.actionable).toBe(false);
  });

  test("Annual vs Pre-Emp independent highlight", () => {
    const cells = [
      "D",
      "Valid",
      isoFromToday(5), // annual due
      "Valid",
      isoFromToday(100), // pre-emp far
      "",
      "",
      "",
      "Active",
      "",
    ];
    const r = row(cells);
    expect(futurePlanHighlightForCell("queries", 6, r)!.actionable).toBe(true);
    expect(futurePlanHighlightForCell("queries", 7, r)!.actionable).toBe(false);
    const def = SECTIONS.find((s) => s.id === "queries")!;
    const { issues } = analyzeRow(def, def.types.map((_, i) => `h${i}`), r);
    expect(issues.some((i) => i.col === 2)).toBe(true);
    expect(issues.some((i) => i.col === 6 || i.col === 7)).toBe(false);
  });

  test("analyzeRow never emits Future Plan labels (pink row separation)", () => {
    for (const rule of PLAN_LEAD_RULES) {
      const lead = typeof rule.leadDays === "number" ? rule.leadDays : 10;
      const cells = new Array(12).fill("");
      cells[0] = "Driver";
      cells[rule.expiryCol] = isoFromToday(Math.max(1, lead - 2));
      if (rule.statusCol != null) cells[rule.statusCol] = "Valid";
      if (rule.stateCol != null) cells[rule.stateCol] = "CA";
      cells[rule.planCol] = ""; // empty plan
      const r = row(cells);
      const def = SECTIONS.find((s) => s.id === rule.sectionId)!;
      const { issues } = analyzeRow(def, def.types.map((_, i) => `h${i}`), r);
      expect(issues.some((i) => /future plan/i.test(i.label))).toBe(false);
      expect(issues.some((i) => i.col === rule.planCol)).toBe(false);
      // Reminder may still be actionable for the suggestion control
      expect(futurePlanHighlightForCell(rule.sectionId, rule.planCol, r)!.actionable).toBe(true);
    }
  });

  test("calendar-day consistency: reminder = expiry − lead", () => {
    const expiry = parseISO("2027-05-07")!;
    const rem = addCalendarDays(expiry, -14);
    expect(toISODateLocal(rem)).toBe("2027-04-23");
    expect(daysUntil(rem) + 14).toBe(daysUntil(expiry));
  });
});
