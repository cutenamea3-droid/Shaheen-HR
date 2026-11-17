import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("downloadReportPdf coerce guards", () => {
  it("stringifies title/subtitle and Array.isArray head/body", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/pdf.ts"), "utf8");
    expect(src).toMatch(/safeTitle/);
    expect(src).toMatch(/safeSubtitle/);
    expect(src).toMatch(/Array\.isArray\(head\)/);
    expect(src).toMatch(/Array\.isArray\(body\)/);
  });
});
