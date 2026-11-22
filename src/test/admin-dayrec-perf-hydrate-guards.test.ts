import { describe, expect, it } from "vitest";
import { normalizeDayRec, normalizePerf } from "@/admin/lib/store";

describe("Admin normalizeDayRec / normalizePerf hydrate guards", () => {
  it("coerces corrupt DayRec note/halfReason/status/punches", () => {
    const rec = normalizeDayRec({
      status: "nope",
      in: "540",
      bin: null,
      bout: "bad",
      out: 1080,
      note: 7,
      halfReason: { x: 1 },
      otMode: "weird",
      otHours: "2.5",
      leavePaid: false,
    });
    expect(rec.status).toBe("present");
    expect(rec.in).toBe(540);
    expect(rec.bin).toBeNull();
    expect(rec.bout).toBeNull();
    expect(rec.out).toBe(1080);
    expect(rec.note).toBe("7");
    expect(rec.halfReason).toBe("[object Object]");
    expect(rec.otMode).toBe("auto");
    expect(rec.otHours).toBe(2.5);
    expect(rec.leavePaid).toBe(false);
  });

  it("falls back for non-object DayRec", () => {
    expect(normalizeDayRec(null).note).toBe("");
    expect(normalizeDayRec("x").status).toBe("present");
  });

  it("coerces Perf rating/note", () => {
    expect(normalizePerf({ rating: "good", note: 3 }).rating).toBe("good");
    expect(normalizePerf({ rating: "good", note: 3 }).note).toBe("3");
    expect(normalizePerf({ rating: "nope", note: null }).rating).toBe("");
    expect(normalizePerf(undefined).note).toBe("");
  });
});
