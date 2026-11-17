import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dispatch LoadEditor autofill fallback", () => {
  it("syncs load number via onInput and reads DOM on save", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/loadNumberRef/);
    expect(src).toMatch(/data-testid="dispatch-load-number"[\s\S]*onInput/);
    expect(src).toMatch(/loadNumberRef\.current\?\.value/);
    expect(src).toMatch(/disabled=\{busy\}/);
  });
});
