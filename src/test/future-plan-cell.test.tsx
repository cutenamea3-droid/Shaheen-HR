import { afterEach, describe, expect, test } from "vitest";
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
});

describe("FuturePlanCell", () => {
  test("renders compact Plans control; suggestion panel hidden by default", () => {
    render(
      <FuturePlanCell
        sectionId="dmv"
        rowId="r1"
        planCol={7}
        value=""
        onSave={() => {}}
        suggestion={suggestion()}
        compact
      />,
    );
    expect(screen.getByRole("button", { name: /Plans/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Apply Suggestion")).toBeNull();
    expect(screen.queryByText("Future Plan suggestion")).toBeNull();
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

    const buttons = screen.getAllByRole("button", { name: /Plans/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Apply Suggestion")).toBeTruthy();
    expect(screen.getByText("Future Plan suggestion")).toBeTruthy();

    // Opening the other driver collapses the first (accordion)
    fireEvent.click(buttons[1]!);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
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
    fireEvent.click(screen.getByRole("button", { name: /Suggestions/i }));
    expect(screen.getByText("Apply Suggestion")).toBeTruthy();
  });
});
