import { describe, expect, it } from "vitest";
import { useApp } from "@/admin/lib/store";

describe("Admin setRec/setPerf coerce note / halfReason / rating", () => {
  it("setRec stringifies non-string note and halfReason", () => {
    useApp.setState({ records: {} });
    useApp.getState().setRec("2026-11-22", "e1", {
      note: 99 as unknown as string,
      halfReason: true as unknown as string,
    });
    const rec = useApp.getState().records["2026-11-22"]!["e1"]!;
    expect(rec.note).toBe("99");
    expect(rec.halfReason).toBe("true");
  });

  it("setPerf stringifies note and clamps bad rating", () => {
    useApp.setState({ perf: {} });
    useApp.getState().setPerf("2026-11-22", "e1", {
      note: { x: 1 } as unknown as string,
      rating: "wat" as never,
    });
    const p = useApp.getState().perf["2026-11-22"]!["e1"]!;
    expect(p.note).toBe("[object Object]");
    expect(p.rating).toBe("");

    useApp.getState().setPerf("2026-11-22", "e1", { rating: "good" });
    expect(useApp.getState().perf["2026-11-22"]!["e1"]!.rating).toBe("good");
  });
});
