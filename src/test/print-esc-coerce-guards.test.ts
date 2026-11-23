import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("print/CSV esc helpers coerce unknown", () => {
  it("dossier / dot-audit / file-completeness / expenses esc stringify", () => {
    const dossier = readFileSync(resolve(process.cwd(), "src/lib/driver-dossier.ts"), "utf8");
    const dot = readFileSync(resolve(process.cwd(), "src/lib/dot-audit.ts"), "utf8");
    const fc = readFileSync(resolve(process.cwd(), "src/lib/file-completeness.ts"), "utf8");
    const exp = readFileSync(resolve(process.cwd(), "src/admin/lib/expenses-reports.ts"), "utf8");
    const dispatch = readFileSync(resolve(process.cwd(), "src/dispatch/lib/reports.ts"), "utf8");

    for (const src of [dossier, dot, fc, exp]) {
      expect(src).toMatch(/typeof s === "string" \? s : String\(s\)|typeof v === "string" \? v : String\(v\)/);
    }
    expect(dispatch).toMatch(/typeof a\.load_id === "string"/);
  });
});
