import { describe, expect, it } from "vitest";
import { normalizeDept, useApp } from "@/admin/lib/store";

describe("Admin dept / log normalize guards", () => {
  it("normalizeDept coerces name and shift minutes", () => {
    const d = normalizeDept({
      id: "d1",
      name: 55 as unknown as string,
      start: "540" as unknown as number,
      end: null as unknown as number,
    });
    expect(d.name).toBe("55");
    expect(d.start).toBe(540);
    expect(d.end).toBe(1140);
  });

  it("upsertDept / addLog coerce through normalize helpers", () => {
    expect(() =>
      useApp.getState().upsertDept({
        id: "dept-x",
        name: 9 as unknown as string,
        start: 600,
        end: 1080,
      }),
    ).not.toThrow();
    const d = useApp.getState().depts.find((x) => x.id === "dept-x");
    expect(typeof d?.name).toBe("string");

    expect(() => useApp.getState().addLog(12 as unknown as string, 34 as unknown as string)).not.toThrow();
    const log = useApp.getState().logs[0];
    expect(typeof log?.who).toBe("string");
    expect(typeof log?.action).toBe("string");
  });
});
