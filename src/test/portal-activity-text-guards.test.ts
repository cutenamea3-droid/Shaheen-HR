import { describe, expect, it } from "vitest";
import { healPortalActivity } from "@/lib/cloud";
import { listLocalActivity, logLocalActivity } from "@/lib/portal-local";

describe("Portal activity text heal guards", () => {
  it("healPortalActivity coerces action/actor/section", () => {
    const row = healPortalActivity({
      id: 7,
      actor_name: true,
      action: { a: 1 },
      section_id: 3,
      occurred_at: "2026-11-22T12:00:00.000Z",
    });
    expect(row?.actor_name).toBe("true");
    expect(row?.action).toBe("[object Object]");
    expect(row?.section_id).toBe("3");
    expect(healPortalActivity({ action: "x" })).toBeNull();
  });

  it("logLocalActivity / listLocalActivity stringify and heal corrupt cache", () => {
    const entry = logLocalActivity({
      actorName: 9 as unknown as string,
      action: true as unknown as string,
      sectionId: { s: 1 } as unknown as string,
    });
    expect(entry.actor_name).toBe("9");
    expect(entry.action).toBe("true");
    expect(entry.section_id).toBe("[object Object]");

    // Corrupt row in the middle of a good list should be dropped on read.
    const list = listLocalActivity(10);
    expect(list.every((e) => typeof e.action === "string")).toBe(true);
  });
});
