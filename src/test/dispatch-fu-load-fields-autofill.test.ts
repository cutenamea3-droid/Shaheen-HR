import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dispatch follow-ups + LoadEditor field autofill", () => {
  it("FollowUpsBoard reads title/due/notes from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    expect(src).toMatch(/fuTitleRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-fu-title"/);
    expect(src).toMatch(/due_at: new Date\(nextDue\)\.toISOString\(\)/);
  });

  it("LoadEditor commodity/equipment/location/datetimes update on input", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/onInput=\{\(e\) => setForm\(\(f\) => \(\{ \.\.\.f, commodity:/);
    expect(src).toMatch(/onInput=\{\(e\) => setForm\(\(f\) => \(\{ \.\.\.f, equipment:/);
    expect(src).toMatch(/onInput=\{\(e\) => setForm\(\(f\) => \(\{ \.\.\.f, last_manual_location:/);
    expect(src).toMatch(/onInput=\{\(e\) => setForm\(\(f\) => \(\{ \.\.\.f, planned_pickup_at:/);
  });
});
