import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("IssuesBoard autofill + migrateData headers", () => {
  it("IssuesBoard reads title/detail/senior note from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/issueTitleRef\.current\?\.value/);
    expect(src).toMatch(/seniorNoteRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-issue-title"/);
    expect(src).toMatch(/data-testid="dispatch-senior-note"/);
  });

  it("migrateData skips sections with missing headers arrays", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/sections.ts"), "utf8");
    expect(src).toMatch(
      /!Array\.isArray\(sec\.rows\) \|\| !Array\.isArray\(sec\.headers\) \|\| sec\.headers\.length !== sp\.oldLen/,
    );
  });
});
