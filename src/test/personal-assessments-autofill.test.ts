import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Personal Assessments autofill fallback", () => {
  it("reads assessment title and prep label from DOM when onChange is skipped", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/personal/components/Assessments.tsx"),
      "utf8",
    );
    expect(src).toMatch(/titleRef/);
    expect(src).toMatch(/titleRef\.current\?\.value/);
    expect(src).toMatch(/prepLabelRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-assessment-add"/);
    expect(src).toMatch(/data-testid="personal-prep-add"/);
  });
});
