import { describe, expect, it } from "vitest";
import {
  healDispatchFollowUp,
  healDispatchIssue,
  healShiftHandover,
  resetDispatchFixtureMemory,
  saveFollowUp,
  saveHandover,
  saveIssue,
} from "@/dispatch/lib/cloud";
import type { DispatchFollowUp, DispatchIssue, ShiftHandover } from "@/dispatch/lib/types";

describe("Dispatch issue/follow-up/handover text heal", () => {
  it("heal* coerce non-string title/summary fields", () => {
    const issue = healDispatchIssue({
      id: "i1",
      load_id: null,
      title: 9 as unknown as string,
      detail: { x: 1 } as unknown as string,
      escalation_level: "ops",
      status: "open",
      senior_informed: false,
      senior_informed_at: null,
      senior_informed_note: null,
      created_at: "",
      updated_at: "",
    } as DispatchIssue);
    expect(issue.title).toBe("9");
    expect(issue.detail).toBe("[object Object]");

    const fu = healDispatchFollowUp({
      id: "f1",
      load_id: null,
      title: true as unknown as string,
      notes: 3 as unknown as string,
      due_at: 20261122 as unknown as string,
      status: "open",
      created_by: null,
      created_at: "",
      updated_at: "",
    } as DispatchFollowUp);
    expect(fu.title).toBe("true");
    expect(fu.notes).toBe("3");
    expect(fu.due_at).toBe("20261122");

    const h = healShiftHandover({
      id: "h1",
      shift_date: 20261122 as unknown as string,
      from_dispatcher: 1 as unknown as string,
      to_dispatcher: null,
      summary: { s: 1 } as unknown as string,
      open_load_ids: [1, "L2"] as unknown as string[],
      watch_items: null as unknown as string,
      next_day_priorities: undefined as unknown as string,
      created_at: "",
      updated_at: "",
    } as ShiftHandover);
    expect(h.summary).toBe("[object Object]");
    expect(h.from_dispatcher).toBe("1");
    expect(h.open_load_ids).toEqual(["1", "L2"]);
    expect(h.watch_items).toBe("");
  });

  it("saveIssue/saveFollowUp/saveHandover stringify titles in preview memory", async () => {
    resetDispatchFixtureMemory();
    const issue = await saveIssue({
      title: 42 as unknown as string,
      detail: true as unknown as string,
    });
    expect(issue.title).toBe("42");
    expect(issue.detail).toBe("true");

    const fu = await saveFollowUp({
      title: { t: 1 } as unknown as string,
      due_at: "2026-11-22T12:00:00.000Z",
    });
    expect(fu.title).toBe("[object Object]");

    const hand = await saveHandover({
      shift_date: "2026-11-22",
      from_dispatcher: "desk",
      summary: 7 as unknown as string,
    });
    expect(hand.summary).toBe("7");
  });
});
