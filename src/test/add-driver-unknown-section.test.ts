import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("addDriver unknown section guard", () => {
  it("skips missing section ids instead of reading .rows on undefined", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(src).toMatch(/Skip unknown section ids/);
    expect(src).toMatch(/if \(!prev \|\| !Array\.isArray\(prev\.rows\)\) continue/);
  });
});
