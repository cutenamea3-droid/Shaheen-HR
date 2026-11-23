import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Personal Analytics grade autofill", () => {
  it("reads grade label from DOM when onChange is skipped", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/personal/components/Analytics.tsx"),
      "utf8",
    );
    expect(src).toMatch(/gLabelRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="personal-grade-label"/);
    expect(src).toMatch(/label: nextGLabel/);
  });
});
