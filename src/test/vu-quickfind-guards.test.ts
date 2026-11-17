import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeVuTerm } from "@/personal/lib/vu-rhythm";

describe("VU rhythm + QuickFind guards", () => {
  it("normalizeVuTerm coerces aliases object before Object.entries", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/vu-rhythm.ts"), "utf8");
    expect(src).toMatch(/typeof aliasesRaw === "object" && !Array\.isArray\(aliasesRaw\)/);
    expect(normalizeVuTerm("GDDB")).toMatch(/GDB/i);
    expect(normalizeVuTerm("  hello  ")).toBe("hello");
  });

  it("QuickFind coerces buildFinderDrivers result", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/QuickFind.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Array\.isArray\(list\) \? list : \[\]/);
  });
});
