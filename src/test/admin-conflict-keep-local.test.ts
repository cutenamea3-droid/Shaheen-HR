import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Admin Not Synced Keep this browser guard", () => {
  it("requires confirm when local attendance looks empty before keep_local upload", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/AdminApp.tsx"), "utf8");
    expect(src).toMatch(/isHrPayloadEmpty/);
    expect(src).toMatch(/isHrMeaningful/);
    expect(src).toMatch(/window\.confirm/);
    expect(src).toMatch(/resolveHrConflict\("keep_local"\)/);
    expect(src).toMatch(/Prefer Use cloud/);
  });
});
