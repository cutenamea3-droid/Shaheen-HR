import { describe, expect, it } from "vitest";
import { normalizeHrAuditEvent, useHrAuditHistory } from "@/admin/lib/hr-audit-history";
import { normalizeMonthCloseRecord, useMonthClosing } from "@/admin/lib/month-closing";

describe("Admin audit + month-close hydrate guards", () => {
  it("normalizeHrAuditEvent coerces who/detail and drops bad kind", () => {
    const ok = normalizeHrAuditEvent({
      kind: "month_close",
      who: 7,
      detail: { x: 1 },
      month: 202611,
      at: "100",
    });
    expect(ok?.who).toBe("7");
    expect(ok?.detail).toBe("[object Object]");
    expect(ok?.month).toBe("202611");
    expect(ok?.at).toBe(100);
    expect(normalizeHrAuditEvent({ kind: "nope", detail: "x" })).toBeNull();
  });

  it("record stringifies who/detail", () => {
    const ev = useHrAuditHistory.getState().record({
      who: 3 as unknown as string,
      kind: "reminder_add",
      detail: true as unknown as string,
    });
    expect(ev.who).toBe("3");
    expect(ev.detail).toBe("true");
  });

  it("normalizeMonthCloseRecord coerces closedBy/reopenReason", () => {
    const rec = normalizeMonthCloseRecord({
      month: "2026-11",
      status: "closed",
      closedBy: 9,
      reopenReason: { r: 1 },
      closedAt: "50",
    });
    expect(rec?.closedBy).toBe("9");
    expect(rec?.reopenReason).toBe("[object Object]");
    expect(rec?.closedAt).toBe(50);
    expect(normalizeMonthCloseRecord({ month: "bad" })).toBeNull();
  });

  it("closeMonth coerces who", () => {
    useMonthClosing.setState({ months: {} });
    const r = useMonthClosing.getState().closeMonth("2026-11", 12 as unknown as string);
    expect(r.ok).toBe(true);
    expect(useMonthClosing.getState().months["2026-11"]?.closedBy).toBe("12");
  });
});
