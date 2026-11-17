import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("DataTable missing rows/headers guards", () => {
  it("uses safeRows/safeHeaders instead of assuming arrays", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/DataTable.tsx"), "utf8");
    expect(src).toMatch(/const safeRows = Array\.isArray\(sec\.rows\)/);
    expect(src).toMatch(/const safeHeaders = Array\.isArray\(sec\.headers\)/);
    expect(src).toMatch(/safeRows\.map\(\(r\) =>/);
    expect(src).toMatch(/const safeHidden = Array\.isArray\(sec\.hidden\)/);
    expect(src).toMatch(/!safeHidden\[i\]/);
    expect(src).not.toMatch(/sec\.rows\.map\(\(r\) => \(\{/);
  });
});
