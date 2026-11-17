import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("OpsControlsBoards UI list guards", () => {
  it("DocList and EquipmentBoard coerce list/labels/activeLoads", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const list = Array\.isArray\(items\) \? items : \[\]/);
    expect(src).toMatch(/Array\.isArray\(row\.equipmentLabels\)/);
    expect(src).toMatch(/Array\.isArray\(row\.activeLoads\)/);
  });

  it("FollowUpList coerces rows/loads and FollowUpsBoard passes safeLoads", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const list = Array\.isArray\(rows\) \? rows : \[\]/);
    expect(src).toMatch(/const loadList = Array\.isArray\(loads\) \? loads : \[\]/);
    expect(src).toMatch(/FollowUpList rows=\{due\} loads=\{safeLoads\}/);
    expect(src).toMatch(/FollowUpList rows=\{open\} loads=\{safeLoads\}/);
  });
});
