import { describe, expect, it } from "vitest";
import { normalizeHrReminder, useHrReminders } from "@/admin/lib/hr-reminders";
import {
  normalizeHrStatement,
  normalizePerfFollowUp,
  usePerfFollowUps,
} from "@/admin/lib/perf-followups";

describe("Admin reminder / perf-followup hydrate guards", () => {
  it("normalizeHrReminder coerces title/due and drops bad due", () => {
    const ok = normalizeHrReminder({
      id: 1,
      title: 9,
      due: "2026-11-22",
      employeeName: null,
      note: { x: 1 },
      status: "open",
    });
    expect(ok?.title).toBe("9");
    expect(ok?.due).toBe("2026-11-22");
    expect(ok?.note).toBe("[object Object]");
    expect(normalizeHrReminder({ due: "nope", title: "x" })).toBeNull();
  });

  it("normalizePerfFollowUp / normalizeHrStatement coerce scalars", () => {
    const fu = normalizePerfFollowUp({
      employeeId: 2,
      due: "2026-11-22",
      title: true,
      status: "done",
      completedAt: "100",
    });
    expect(fu?.employeeId).toBe("2");
    expect(fu?.title).toBe("true");
    expect(fu?.completedAt).toBe(100);

    const st = normalizeHrStatement({
      employeeId: null,
      date: "2026-11-22",
      text: 3,
    });
    expect(st?.text).toBe("3");
    expect(normalizeHrStatement({ date: "bad", text: "x" })).toBeNull();
  });

  it("add paths stringify due before store", () => {
    const rem = useHrReminders.getState().add({
      title: "Guard rem",
      due: "2026-11-22" as unknown as string,
    });
    expect("error" in rem).toBe(false);
    if (!("error" in rem)) expect(typeof rem.due).toBe("string");

    const fu = usePerfFollowUps.getState().addFollowUp({
      employeeId: "e1",
      employeeName: "A",
      due: "2026-11-22",
      title: "Guard fu",
    });
    expect("error" in fu).toBe(false);
    if (!("error" in fu)) expect(typeof fu.due).toBe("string");
  });
});
