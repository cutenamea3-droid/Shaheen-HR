import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { downloadCsv } from "@/admin/lib/reports";

describe("admin report download list guards", () => {
  it("downloadPdf/downloadCsv coerce tables/head/rows", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/reports.ts"), "utf8");
    expect(src).toMatch(/const list = Array\.isArray\(tables\) \? tables : \[\]/);
    expect(src).toMatch(/const head = Array\.isArray\(t\.head\) \? t\.head : \[\]/);
    expect(src).toMatch(/const rows = Array\.isArray\(t\.rows\) \? t\.rows : \[\]/);
  });

  it("downloadCsv tolerates non-array tables", () => {
    expect(() => downloadCsv(null as never, "x.csv")).not.toThrow();
  });
});
