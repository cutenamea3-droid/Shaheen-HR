import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dispatch stops Array.isArray guards (no truthy string .length)", () => {
  it("cloud helpers use arrayStops/withStops — never load.stops ?", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/function arrayStops\(stops: unknown\)/);
    expect(src).toMatch(/function withStops\(stops: unknown\)/);
    expect(src).toMatch(/const nextStops = arrayStops\(input\.stops\)/);
    expect(src).not.toMatch(/load\.stops \? \{ stops: load\.stops \}/);
    expect(src).not.toMatch(/if \(input\.stops\)/);
  });

  it("DocsBoard patchDoc only spreads Array.isArray stops", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/OpsControlsBoards.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Array\.isArray\(load\.stops\) \? \{ stops: load\.stops \}/);
    expect(src).not.toMatch(/load\.stops \? \{ stops: load\.stops \}/);
  });

  it("cloud/auth list results use Array.isArray — never (data ?? []) alone", () => {
    const cloud = readFileSync(resolve(process.cwd(), "src/dispatch/lib/cloud.ts"), "utf8");
    const auth = readFileSync(resolve(process.cwd(), "src/dispatch/lib/auth.ts"), "utf8");
    expect(cloud).toMatch(/function asRows<T>\(data: unknown\): T\[\]/);
    expect(cloud).toMatch(/asRows<LoadStop>\(stops\)/);
    expect(cloud).not.toMatch(/\(data \?\? \[\]\) as /);
    expect(cloud).not.toMatch(/\(stops \?\? \[\]\) as /);
    expect(auth).toMatch(/Array\.isArray\(data\) \? \(data as DispatchAccount\[\]\) : \[\]/);
    expect(auth).not.toMatch(/\(data \?\? \[\]\) as DispatchAccount/);
  });
});
