import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("missing section rows UI guards", () => {
  it("AppShell nav counts skip sections without rows", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/AppShell.tsx"), "utf8");
    expect(src).toMatch(/if \(!sec \|\| !Array\.isArray\(sec\.rows\)\)/);
    expect(src).toMatch(/const headers = headersOf\(sec\)/);
    expect(src).toMatch(/analyzeRow\(def, headers, r\)/);
  });

  it("DataTable uses empty fallback when section rows missing", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/tracker/DataTable.tsx"), "utf8");
    expect(src).toMatch(/sectionMissing/);
    expect(src).toMatch(/missing or corrupt cloud data/);
  });

  it("setCell returns early when rows missing", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(src).toMatch(
      /export function setCell[\s\S]*?if \(!sec \|\| !Array\.isArray\(sec\.rows\)\) return d/,
    );
  });

  it("DriverCards SectionFields tolerates missing section", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Section unavailable \(missing or corrupt cloud data\)/);
    expect(src).toMatch(/const headers = headersOf\(sec\)/);
    expect(src).toMatch(/const cells = cellsOf\(row\)/);
  });

  it("Dashboard section alert panel skips missing rows/headers", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/Dashboard.tsx"),
      "utf8",
    );
    expect(src).toMatch(/if \(!sec \|\| !Array\.isArray\(sec\.rows\)\) return \[\]/);
    expect(src).toMatch(/const headers = headersOf\(sec\)/);
  });
});
