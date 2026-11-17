import { describe, expect, it } from "vitest";
import { isDateInClosedMonth, monthOfDate } from "@/admin/lib/month-closing";
import { datesInRange } from "@/admin/lib/reports";
import { buildCompleteLoadHistory } from "@/dispatch/lib/closeout";

describe("date slice / localeCompare coerce", () => {
  it("monthOfDate / isDateInClosedMonth / datesInRange tolerate non-strings", () => {
    expect(monthOfDate(20261117 as unknown as string)).toBe("2026111");
    expect(monthOfDate("2026-11-17")).toBe("2026-11");
    expect(isDateInClosedMonth(null as unknown as string, () => true)).toBe(false);
    expect(isDateInClosedMonth("2026-11-17", () => true)).toBe(true);
    expect(() => datesInRange(20261101 as unknown as string, 20261102 as unknown as string)).not.toThrow();
    expect(datesInRange("2026-11-01", "2026-11-02")).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("buildCompleteLoadHistory sorts when event timestamps are non-strings", () => {
    const load = {
      id: "L1",
      load_number: "X",
      status: "delivered",
      payment_status: "unpaid",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      closed_at: null,
      cancelled_at: null,
      reopened_at: null,
      reopen_reason: null,
      closeout_note: null,
      last_manual_location: null,
      last_manual_location_at: null,
      actual_pickup_at: null,
      actual_delivery_at: null,
      exception_open: false,
    } as never;
    expect(() =>
      buildCompleteLoadHistory({
        load,
        checkCalls: [
          {
            called_at: 9 as unknown as string,
            notes: "n",
            manual_location: null,
          },
        ],
        issues: [],
        followUps: [],
        communications: [],
        accessorials: [],
      } as never),
    ).not.toThrow();
  });
});
