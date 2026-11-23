import { describe, expect, it } from "vitest";
import { analyzeRow } from "@/lib/alerts";
import { SECTIONS } from "@/lib/sections";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("missing cells array guards", () => {
  it("analyzeRow tolerates missing cells", () => {
    const def = SECTIONS.find((s) => s.id === "dmv")!;
    expect(() =>
      analyzeRow(def, def.types.map((_, i) => `h${i}`), {
        id: "r1",
        driverId: "d1",
        cells: null as unknown as string[],
      }),
    ).not.toThrow();
    const out = analyzeRow(def, [], { id: "r1", driverId: "d1", cells: undefined as unknown as string[] });
    expect(Array.isArray(out.issues)).toBe(true);
  });

  it("setCell / normalizeRecord / follow-ups coerce missing cells", () => {
    const storeSrc = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(storeSrc).toMatch(/cellsOf\(r\)/);
    expect(storeSrc).not.toMatch(/Array\.isArray\(r\.cells\) \? r\.cells : \[\]/);
    const alerts = readFileSync(resolve(process.cwd(), "src/lib/alerts.ts"), "utf8");
    expect(alerts).toMatch(/const c = cellsOf\(row\)/);
    expect(alerts).not.toMatch(/Array\.isArray\(row\.cells\) \? row\.cells : \[\]/);
    const fu = readFileSync(resolve(process.cwd(), "src/lib/follow-ups.ts"), "utf8");
    expect(fu).toMatch(/const base = cellsOf\(r\)/);
    const sec = readFileSync(resolve(process.cwd(), "src/lib/sections.ts"), "utf8");
    expect(sec).toMatch(/cells: \[\.\.\.cellsOf\(r\)\]/);
  });
});
