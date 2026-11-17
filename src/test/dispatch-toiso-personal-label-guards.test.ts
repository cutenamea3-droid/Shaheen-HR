import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dispatch toIsoOrNull + Personal Today label.includes guards", () => {
  it("DispatchApp uses toIsoOrNull; OpsControls parses due; Today coerces label", () => {
    const app = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    const ops = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    const today = readFileSync(
      resolve(process.cwd(), "src/personal/components/Today.tsx"),
      "utf8",
    );
    expect(app).toMatch(/function toIsoOrNull\(v: unknown\): string \| null/);
    expect(app).toMatch(/planned_pickup_at: toIsoOrNull\(form\.planned_pickup_at\)/);
    expect(app).toMatch(/planned_at: toIsoOrNull\(e\.target\.value\)/);
    expect(app).not.toMatch(/const toIso = \(v: string\) => \(v \? new Date\(v\)\.toISOString\(\)/);
    expect(ops).toMatch(/const dueMs = Date\.parse\(nextDue\)/);
    expect(ops).toMatch(/due_at: new Date\(dueMs\)\.toISOString\(\)/);
    expect(today).toMatch(/typeof x\.label === "string" \? x\.label : String\(x\.label\)/);
    expect(today).not.toMatch(/x\.label\.includes\(block\.todoTitle/);
  });
});
