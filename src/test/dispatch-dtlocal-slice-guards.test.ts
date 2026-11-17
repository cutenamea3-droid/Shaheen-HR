import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dispatch datetime-local slice coerce", () => {
  it("LoadEditor uses asDtLocal before slice for pickup/delivery and stop times", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/function asDtLocal\(v: unknown\): string/);
    expect(src).toMatch(/planned_pickup_at: asDtLocal\(load\?\.planned_pickup_at\)/);
    expect(src).toMatch(/actual_pickup_at: asDtLocal\(load\?\.actual_pickup_at\)/);
    expect(src).toMatch(/planned_delivery_at: asDtLocal\(load\?\.planned_delivery_at\)/);
    expect(src).toMatch(/actual_delivery_at: asDtLocal\(load\?\.actual_delivery_at\)/);
    expect(src).toMatch(/value=\{asDtLocal\(stop\.planned_at\)\}/);
    expect(src).toMatch(/value=\{asDtLocal\(stop\.actual_at\)\}/);
    expect(src).not.toMatch(/planned_pickup_at\?\.slice\(0,\s*16\)/);
    expect(src).not.toMatch(/stop\.planned_at\?\.slice\(0,\s*16\)/);
  });
});
