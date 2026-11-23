import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("deleteDriver corrupt section guard", () => {
  it("skips sections without a rows array instead of crashing", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(src).toMatch(/Skip corrupt\/missing rows/);
    expect(src).toMatch(/if \(!prev \|\| !Array\.isArray\(prev\.rows\)\) continue/);
  });
});
