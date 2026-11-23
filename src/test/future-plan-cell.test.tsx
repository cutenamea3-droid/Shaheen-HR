import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FuturePlanCell } from "@/components/tracker/FuturePlanCell";
import { FuturePlanSuggest } from "@/components/tracker/FuturePlanSuggest";
import { setFuturePlanExpanded } from "@/lib/future-plan-expand";
import type { FuturePlanSuggestion } from "@/lib/plan-dates";

const suggestion = (over: Partial<FuturePlanSuggestion> = {}): FuturePlanSuggestion => ({
  available: true,
  text: "I will Apply on April 23 (Friday), 2027",
  reminderDate: null,
  reminderISO: "2027-04-23",
  reminderLabel: "April 23 (Friday), 2027",
  expiryDate: null,
  expiryISO: "2027-05-07",
  expiryLabel: "May 7, 2027",
  leadDays: 14,
  wording: "apply",
  docLabel: "DMV Pull Notice",
  source: "test",
  overdue: false,
  overdueDays: null,
  suppressReapply: false,
  suppressReason: null,
  sectionId: "dmv",
  planCol: 7,
  expiryCol: 3,
  statusCol: 2,
  ...over,
});

afterEach(() => {
  cleanup();
  setFuturePlanExpanded(null);
  try {
    sessionStorage.removeItem("shaheen.futurePlanExpand.v1");
  } catch {
    /* ignore */
  }
  vi.restoreAllMocks();
});

describe("FuturePlanCell", () => {
  test("shows My Saved Future Plan; suggestion collapsed by default", () => {
    render(
      <FuturePlanCell
        sectionId="dmv"
        rowId="r1"
        planCol={7}
        value="Manual saved plan"
        onSave={() => {}}
        suggestion={suggestion()}
        compact
      />,
    );
    expect(screen.getByText(/My Saved Future Plan/i)).toBeTruthy();
    expect(screen.getByText("Manual saved plan")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: /View Automatic Suggestion/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Apply Suggestion")).toBeNull();
  });

  test("expands only after click; second driver stays collapsed", () => {
    render(
      <div>
        <FuturePlanCell
          sectionId="dmv"
          rowId="r1"
          planCol={7}
          value="Manual plan"
          onSave={() => {}}
          suggestion={suggestion()}
        />
        <FuturePlanCell
          sectionId="dmv"
          rowId="r2"
          planCol={7}
          value=""
          onSave={() => {}}
          suggestion={suggestion({ text: "Other driver suggestion", rowId: "r2" } as never)}
        />
      </div>,
    );

    const buttons = screen.getAllByRole("button", { name: /View Automatic Suggestion/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Apply Suggestion")).toBeTruthy();
    expect(screen.getByText(/Source expiry/i)).toBeTruthy();
    expect(screen.getByText(/Lead time/i)).toBeTruthy();
    expect(screen.getByText(/Reminder/i)).toBeTruthy();

    // Opening the other driver collapses the first (accordion)
    fireEvent.click(buttons[1]!);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
  });

  test("shows Already matches saved plan when texts equal", () => {
    const text = "I will Apply on April 23 (Friday), 2027";
    render(
      <FuturePlanCell
        sectionId="dmv"
        rowId="r1"
        planCol={7}
        value={text}
        onSave={() => {}}
        suggestion={suggestion({ text })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /View Automatic Suggestion/i }));
    expect(screen.getByText("Already matches saved plan.")).toBeTruthy();
    expect(screen.queryByText("Apply Suggestion")).toBeNull();
  });
});

describe("FuturePlanSuggest standalone", () => {
  test("suggestions stay hidden until explicit open", () => {
    render(
      <FuturePlanSuggest
        suggestion={suggestion()}
        existingPlan=""
        sectionId="dmv"
        rowId="wc1"
        planCol={7}
      />,
    );
    expect(screen.queryByText("Apply Suggestion")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /View Automatic Suggestion/i }));
    expect(screen.getByText("Apply Suggestion")).toBeTruthy();
  });

  test("reminder-due cue highlights suggestion control only", () => {
    render(
      <FuturePlanSuggest
        suggestion={suggestion()}
        existingPlan=""
        sectionId="dmv"
        rowId="wc1"
        planCol={7}
        reminderActionable
        suggestionTone="warn"
      />,
    );
    const toggle = screen.getByRole("button", { name: /Reminder due/i });
    expect(toggle).toHaveAttribute("data-reminder-due", "1");
    expect(toggle.className).toMatch(/bg-warn-soft/);
  });

  test("confirm before replacing a different saved plan", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <FuturePlanSuggest
        suggestion={suggestion()}
        existingPlan="Keep my manual plan"
        sectionId="dmv"
        rowId="wc1"
        planCol={7}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /View Automatic Suggestion/i }));
    fireEvent.click(screen.getByRole("button", { name: /Apply Suggestion/i }));
    expect(confirmSpy).toHaveBeenCalled();
  });
});
