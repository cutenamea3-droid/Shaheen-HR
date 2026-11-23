import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { healHrBlob } from "@/admin/lib/store";
import { buildHrToday } from "@/admin/lib/hr-today";

/**
 * PR #52 ConflictChooser allocated `useApp((s) => ({ employees, records }))` every
 * snapshot → React #185 → Admin ModuleErrorPanel "didn't load" when conflict mounted.
 */
describe("ConflictChooser stable zustand snapshots (React #185)", () => {
  const src = readFileSync(resolve(process.cwd(), "src/admin/AdminApp.tsx"), "utf8");

  it("does not allocate a fresh object inside useApp selector", () => {
    expect(src).not.toMatch(/useApp\(\(s\)\s*=>\s*\(\s*\{\s*employees/);
    expect(src).toMatch(/useApp\(\(s\)\s*=>\s*s\.employees\)/);
    expect(src).toMatch(/useApp\(\(s\)\s*=>\s*s\.records\)/);
  });

  it("wraps ConflictChooser in AdminIslandBoundary", () => {
    expect(src).toMatch(/AdminIslandBoundary/);
    expect(src).toMatch(/<ConflictChooser\s*\/>/);
  });
});

describe("healHrBlob + buildHrToday harden corrupt cloud apply", () => {
  it("heals null settings and holey employees so buildHrToday does not throw", () => {
    const healed = healHrBlob({
      employees: [null, { id: "e1", name: "A", deptId: "d1" }, undefined] as unknown as never,
      settings: null as unknown as never,
      tasks: [{ id: "t1", title: "Daily", kind: "daily", due: "2026-01-01", done: false }],
      records: {},
      depts: [{ id: "d1", name: "Ops", start: 480, end: 1020 }],
      team: [],
      logs: [],
      perf: {},
    });

    expect(healed.employees).toHaveLength(1);
    expect(healed.employees[0]!.id).toBe("e1");
    expect(healed.settings.grace).toEqual(expect.any(Number));
    expect(healed.tasks[0]!.doneDays).toEqual([]);

    expect(() =>
      buildHrToday({
        date: "2026-01-01",
        employees: healed.employees,
        depts: healed.depts,
        records: healed.records,
        settings: healed.settings,
      }),
    ).not.toThrow();
  });

  it("buildHrToday tolerates null settings and null employee rows without heal", () => {
    expect(() =>
      buildHrToday({
        date: "2026-01-01",
        employees: [null as unknown as never, { id: "e1", name: "A", deptId: "d1" } as never],
        depts: [],
        records: {},
        settings: null as unknown as never,
      }),
    ).not.toThrow();
  });
});
