import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const stylesPath = resolve(process.cwd(), "src/styles.css");

test("Driver Compliance dark theme uses cool charcoal canvas tokens", () => {
  const css = readFileSync(stylesPath, "utf8");
  expect(css).toMatch(/\.dark\s*\{[\s\S]*?--background:\s*#0f1419/);
  expect(css).toMatch(/\.dark\s*\{[\s\S]*?--card:\s*#171d25/);
  expect(css).toMatch(/\.dark\s*\{[\s\S]*?--foreground:\s*#e8eef4/);
  expect(css).toMatch(/\.dark\s*\{[\s\S]*?--muted-foreground:\s*#9aa6b5/);
  expect(css).toMatch(/\.dark\s*\{[\s\S]*?--border:\s*#2c3542/);
  expect(css).toMatch(/\.dark\s*\{[\s\S]*?--input:\s*#323c4c/);
});

test("dark accent is neutral (no orange surface wash)", () => {
  const css = readFileSync(stylesPath, "utf8");
  const darkBlock = css.match(/\/\* ---------- Dark Mode[\s\S]*?\/\* Excel-style selected row \*\//)?.[0] ?? "";
  expect(darkBlock.length).toBeGreaterThan(200);
  // Accent must be a cool slate surface, not brand-orange mix
  expect(darkBlock).toMatch(/--accent:\s*#243040/);
  expect(darkBlock).not.toMatch(/--accent:\s*color-mix\(in srgb,\s*var\(--brand-orange\)/);
  // Soft status chips stay low-chroma mixes (≤14%)
  expect(darkBlock).toMatch(/--danger-row:\s*color-mix\(in srgb,\s*#f07178\s+7%/);
  expect(darkBlock).toMatch(/--ok-soft:\s*color-mix\(in srgb,\s*#4adea8\s+14%/);
});

test("dark sticky table headers are slate, not orange wash", () => {
  const css = readFileSync(stylesPath, "utf8");
  expect(css).toMatch(
    /\.dark\s+\.tracker-table-wrap\s+thead\.sticky\s+th\s*\{[\s\S]*?background-color:\s*#1a222d/,
  );
  expect(css).toMatch(
    /\.dark\s+\.tracker-table-wrap\s+thead\.sticky\s+th\s*\{[\s\S]*?background-image:\s*none/,
  );
});

test("Driver body canvas follows --background (works in dark)", () => {
  const css = readFileSync(stylesPath, "utf8");
  expect(css).toMatch(
    /body:not\(:has\(\.admin-theme\)\):not\(:has\(\.cv-theme\)\)\s*\{\s*background-color:\s*var\(--background\)/,
  );
  // Brand-red remap for alert classes is light-mode only
  expect(css).toMatch(/html:not\(\.dark\)\s+\.bg-danger-row/);
});
