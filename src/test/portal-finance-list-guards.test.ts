import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Portal + Admin finance list Array.isArray guards", () => {
  it("Compliance portal listPortalAccounts/Activity never use (data ?? []) alone", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/const rows = Array\.isArray\(data\) \? data : \[\]/);
    expect(src).toMatch(/\(Array\.isArray\(data\) \? data : \[\]\)/);
    expect(src).toMatch(/healPortalActivity/);
    expect(src).not.toMatch(/return \(data \?\? \[\]\)\.filter/);
    expect(src).not.toMatch(/return data \?\? \[\]/);
  });

  it("Admin secure finance lists coerce with Array.isArray before .map", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/lib/employee-finance-secure.ts"),
      "utf8",
    );
    expect(src).toMatch(/const rows = Array\.isArray\(data\) \? data : \[\]/);
    expect(src).not.toMatch(/\(\(data as unknown\[\]\) \?\? \[\]\)\.map/);
  });
});
