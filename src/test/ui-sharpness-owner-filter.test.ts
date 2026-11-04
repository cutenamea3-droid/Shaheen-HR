import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import seed from "@/data/seed.json";
import type { AppData, Row } from "@/lib/sections";
import { RECORD_SECTION_IDS } from "@/lib/store";

const stylesPath = resolve(process.cwd(), "src/styles.css");

test("styles.css avoids global GPU/scale soft-text traps", () => {
  const css = readFileSync(stylesPath, "utf8");

  // Prior "sharpen" attempt promoted every node — must stay gone.
  expect(css).not.toMatch(/\*\s*\{[^}]*transform:\s*translateZ\(0\)/s);
  expect(css).not.toMatch(/-webkit-font-smoothing:\s*antialiased/);
  expect(css).not.toMatch(/text-rendering:\s*optimizeLegibility/);

  // Hover scale blurs table/button glyphs; lift may translateY only.
  expect(css).not.toMatch(/transform:\s*translateY\([^)]+\)\s+scale\(/);

  // Persistent will-change layers softens resting text.
  expect(css).not.toMatch(/will-change:\s*transform/);

  // Row hover must not use filter:brightness (softens cell text).
  expect(css).not.toMatch(/\.ui-row-hover[^{]*\{[^}]*filter:\s*brightness/s);
  expect(css).not.toMatch(/\.admin-theme table tbody tr:hover > td\s*\{[^}]*filter:\s*brightness/s);

  expect(css).toMatch(/-webkit-font-smoothing:\s*auto/);
  expect(css).toMatch(/text-rendering:\s*geometricPrecision/);
});

test("compliance rows have no driver-type / owner-operator field", () => {
  const data = seed as AppData;
  const dmvRows = data.sections.dmv?.rows ?? [];
  expect(dmvRows.length).toBeGreaterThan(0);

  for (const row of dmvRows.slice(0, 20) as Row[]) {
    const keys = Object.keys(row);
    expect(keys).not.toContain("driverType");
    expect(keys).not.toContain("driver_type");
    expect(keys).not.toContain("ownerOperator");
    expect(keys).not.toContain("owner_operator");
    expect(keys).not.toContain("employmentType");
  }
});

test("Records Owner Operators are not linked into the DMV compliance roster", () => {
  const data = seed as AppData;
  expect(RECORD_SECTION_IDS).toContain("rec_owners");

  const ownerNames = new Set(
    (data.sections.rec_owners?.rows ?? [])
      .map((r) => (r.cells[0] ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const dmvNames = new Set(
    (data.sections.dmv?.rows ?? [])
      .map((r) => (r.cells[0] ?? "").trim().toLowerCase())
      .filter(Boolean),
  );

  expect(ownerNames.size).toBeGreaterThan(0);
  expect(dmvNames.size).toBeGreaterThan(0);

  const overlap = [...ownerNames].filter((n) => dmvNames.has(n));
  // No shared driverId link and seed names do not overlap — a compliance
  // "Owner Operators" filter cannot be derived without new classification data.
  expect(overlap).toEqual([]);
});
