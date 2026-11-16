import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AddDriverDialog missing-section + autofill guards", () => {
  it("skips missing sections and reads base fields from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/AddDriverDialog.tsx"),
      "utf8",
    );
    expect(src).toMatch(/readBase/);
    expect(src).toMatch(/if \(!sec\) continue;/);
    expect(src).toMatch(/const headers = sec\.headers \?\? \[\]/);
    expect(src).toMatch(/data-testid="add-driver-name"/);
    expect(src).toMatch(/onInput=\{\(e\) => setBase\(\(b\) =>/);
  });
});
