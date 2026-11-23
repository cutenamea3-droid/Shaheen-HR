import { afterEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clearFuturePlanExpandedIf,
  futurePlanCollapsedCount,
  futurePlanExpandKey,
  getFuturePlanExpandedKey,
  isFuturePlanExpanded,
  setFuturePlanExpanded,
  toggleFuturePlanExpanded,
} from "@/lib/future-plan-expand";

afterEach(() => {
  setFuturePlanExpanded(null);
  try {
    sessionStorage.removeItem("shaheen.futurePlanExpand.v1");
  } catch {
    /* ignore */
  }
});

describe("future-plan-expand accordion", () => {
  test("starts with nothing expanded", () => {
    expect(getFuturePlanExpandedKey()).toBeNull();
    expect(isFuturePlanExpanded("dmv:row1:7")).toBe(false);
  });

  test("toggle opens one key and collapses previous", () => {
    const a = futurePlanExpandKey("dmv", "r1", 7);
    const b = futurePlanExpandKey("dmv", "r2", 7);
    toggleFuturePlanExpanded(a);
    expect(isFuturePlanExpanded(a)).toBe(true);
    toggleFuturePlanExpanded(b);
    expect(isFuturePlanExpanded(a)).toBe(false);
    expect(isFuturePlanExpanded(b)).toBe(true);
    toggleFuturePlanExpanded(b);
    expect(getFuturePlanExpandedKey()).toBeNull();
  });

  test("clearFuturePlanExpandedIf only clears matching key", () => {
    const a = futurePlanExpandKey("medical", "r1", 6);
    setFuturePlanExpanded(a);
    clearFuturePlanExpandedIf("other");
    expect(isFuturePlanExpanded(a)).toBe(true);
    clearFuturePlanExpandedIf(a);
    expect(getFuturePlanExpandedKey()).toBeNull();
  });

  test("collapsed count: actionable + saved plan", () => {
    expect(
      futurePlanCollapsedCount({
        hasSuggestion: true,
        suggestionActionable: true,
        hasSavedPlan: true,
      }),
    ).toBe(2);
    expect(
      futurePlanCollapsedCount({
        hasSuggestion: true,
        suggestionActionable: false,
        hasSavedPlan: false,
      }),
    ).toBe(1);
    expect(
      futurePlanCollapsedCount({
        hasSuggestion: false,
        suggestionActionable: false,
        hasSavedPlan: false,
      }),
    ).toBe(0);
  });
});

describe("Future Plans UI — collapsed by default (source guards)", () => {
  test("DataTable and DriverCards use FuturePlanCell for plan columns", () => {
    const dt = readFileSync(resolve(process.cwd(), "src/components/tracker/DataTable.tsx"), "utf8");
    const cards = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"),
      "utf8",
    );
    expect(dt).toMatch(/FuturePlanCell/);
    expect(cards).toMatch(/FuturePlanCell/);
    expect(dt).not.toMatch(/from "\.\/FuturePlanSuggest"/);
    expect(cards).not.toMatch(/from "\.\/FuturePlanSuggest"/);
  });

  test("FuturePlanCell always shows saved plan; never auto-opens suggestion", () => {
    const cell = readFileSync(
      resolve(process.cwd(), "src/components/tracker/FuturePlanCell.tsx"),
      "utf8",
    );
    expect(cell).toMatch(/data-future-plan-cell/);
    expect(cell).toMatch(/My Saved Future Plan/);
    expect(cell).toMatch(/Never auto-expands/);
    expect(cell).toMatch(/FuturePlanSuggest/);
    expect(cell).not.toMatch(/defaultOpen\s*=\s*true/);
    expect(cell).not.toMatch(/useState\(\s*true\s*\)/);
    expect(cell).not.toMatch(/embedded/);
  });

  test("FuturePlanSuggest stays hidden until explicit open", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/FuturePlanSuggest.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Never auto-expands/);
    expect(src).toMatch(/View Automatic Suggestion/);
    expect(src).toMatch(/\{open && panel\}/);
    expect(src).toMatch(/data-future-plan-suggest-toggle/);
    expect(src).toMatch(/window\.confirm/);
    expect(src).toMatch(/Already matches saved plan/);
    expect(src).not.toMatch(/defaultOpen\s*=\s*true/);
    expect(src).not.toMatch(/useState\(\s*true\s*\)/);
  });

  test("Alerts work center uses FuturePlanSuggest without forcing expand", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AlertsWorkCenter.tsx"),
      "utf8",
    );
    expect(src).toMatch(/<FuturePlanSuggest/);
    expect(src).toMatch(/My Saved Future Plan/);
    expect(src).not.toMatch(/embedded\s*=\s*\{?true\}?/);
    expect(src).not.toMatch(/defaultOpen|defaultExpanded|autoExpand/);
  });
});
