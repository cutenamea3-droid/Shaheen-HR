import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Personal Backlog autofill fallback", () => {
  it("reads label/mins from DOM when onChange is skipped", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/components/Backlog.tsx"), "utf8");
    expect(src).toMatch(/labelRef/);
    expect(src).toMatch(/labelRef\.current\?\.value/);
    expect(src).toMatch(/onInput=\{\(e\) => setLabel/);
    expect(src).toMatch(/data-testid="personal-backlog-add"/);
  });
});
