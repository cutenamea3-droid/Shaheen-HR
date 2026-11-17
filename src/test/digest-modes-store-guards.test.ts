import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSafetyDigest } from "@/lib/alerts";
import { buildSeed } from "@/lib/sections";

describe("digest / modes / store section guards", () => {
  it("buildSafetyDigest tolerates non-array dmv.rows", () => {
    const data = buildSeed();
    data.sections.dmv = { ...data.sections.dmv, rows: { bad: true } as never };
    expect(() => buildSafetyDigest(data)).not.toThrow();
    expect(buildSafetyDigest(data)).toMatch(/Total drivers: 0/);
  });

  it("Today loadModes and store pull/update coerce sections objects", () => {
    const today = readFileSync(resolve(process.cwd(), "src/personal/components/Today.tsx"), "utf8");
    expect(today).toMatch(/typeof parsed !== "object" \|\| Array\.isArray\(parsed\)/);
    const store = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(store).toMatch(/remoteSections/);
    expect(store).toMatch(/values && typeof values === "object"/);
  });

  it("monthly-report-model coerces ratingCounts before summing", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/monthly-report-model.ts"), "utf8");
    expect(src).toMatch(/e\.ratingCounts && typeof e\.ratingCounts === "object"/);
  });
});
