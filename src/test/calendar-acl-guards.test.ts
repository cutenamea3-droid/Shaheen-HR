import { describe, expect, it } from "vitest";
import { eventsInRange, eventsOnDay } from "@/lib/plan-calendar";
import { resolveAccess, seatsToGrants, isDispatchOnly } from "@/lib/module-access/policy";

describe("calendar / ACL corrupt-shape guards", () => {
  it("eventsOnDay/eventsInRange tolerate non-array events", () => {
    const day = new Date(2026, 10, 17);
    expect(eventsOnDay(null as never, day)).toEqual([]);
    expect(eventsInRange("bad" as never, day, day)).toEqual([]);
  });

  it("resolveAccess / seatsToGrants heal null grants and non-array seats", () => {
    expect(() => resolveAccess(null as never)).not.toThrow();
    expect(resolveAccess(null as never).homePath).toBe("/access-denied");
    expect(seatsToGrants(null as never)).toEqual({
      compliance: null,
      "admin-hr": null,
      personal: null,
      dispatch: null,
    });
    expect(isDispatchOnly(null as never)).toBe(false);
  });
});
