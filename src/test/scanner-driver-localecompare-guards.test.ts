import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "src/lib/alerts.ts",
  "src/lib/alerts-work-center.ts",
  "src/lib/follow-ups.ts",
  "src/lib/data-quality.ts",
  "src/lib/inspection-readiness.ts",
  "src/lib/file-completeness.ts",
  "src/lib/quick-find.ts",
  "src/lib/dot-audit.ts",
  "src/lib/plan-calendar.ts",
];

describe("scanner driver/name localeCompare coerce", () => {
  it("sorts stringify driver/name before localeCompare", () => {
    for (const file of FILES) {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src).toMatch(/typeof v === "string" \? v : String\(v\)/);
    }
  });
});
