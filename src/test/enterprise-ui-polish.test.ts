import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const stylesPath = resolve(process.cwd(), "src/styles.css");

test("styles.css locks enterprise brand hex tokens", () => {
  const css = readFileSync(stylesPath, "utf8");
  expect(css).toMatch(/--brand-orange:\s*#E87500/i);
  expect(css).toMatch(/--brand-slate:\s*#202A36/i);
  expect(css).toMatch(/--brand-soft-white:\s*#F7F8FA/i);
  expect(css).toMatch(/--brand-green:\s*#16845B/i);
  expect(css).toMatch(/--brand-blue:\s*#2563EB/i);
  expect(css).toMatch(/--brand-red:\s*#CF3540/i);
});

test("styles.css keeps temp notes neutral and alerts on brand red", () => {
  const css = readFileSync(stylesPath, "utf8");
  // Temp notes must not reuse danger/warn as their base token in :root
  expect(css).toMatch(/\/\* Temp notes: neutral slate/);
  expect(css).toMatch(/--danger:\s*var\(--brand-red/);
  expect(css).toMatch(/--ok:\s*var\(--brand-green/);
  expect(css).toMatch(/--info:\s*var\(--brand-blue/);
});

test("styles.css does not reintroduce soft-text GPU / blur traps", () => {
  const css = readFileSync(stylesPath, "utf8");
  expect(css).not.toMatch(/\*\s*\{[^}]*transform:\s*translateZ\(0\)/s);
  expect(css).not.toMatch(/transform:\s*translateY\([^)]+\)\s+scale\(/);
  expect(css).not.toMatch(/will-change:\s*transform/);
  // Glow edge must not use filter:blur (softens nearby glyphs)
  expect(css).not.toMatch(/\.panel::before[\s\S]*?filter:\s*blur\(/);
  expect(css).toMatch(/\.ui-glow::before,\s*\n\.panel::before\s*\{[\s\S]*?filter:\s*none;/);
});

test("Admin theme stays scoped under .admin-theme with brand orange", () => {
  const css = readFileSync(stylesPath, "utf8");
  expect(css).toMatch(/\.admin-theme\s*\{[\s\S]*?--primary:\s*var\(--brand-orange/);
  expect(css).toMatch(/\.admin-theme\s*\{[\s\S]*?--sidebar:\s*var\(--brand-slate/);
});
