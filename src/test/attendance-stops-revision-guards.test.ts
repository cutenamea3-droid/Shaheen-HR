import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterNotesByTag, suggestRevisionTargets } from "@/personal/lib/revision";
import { usePerfFollowUps } from "@/admin/lib/perf-followups";
import { useMonthClosing } from "@/admin/lib/month-closing";

describe("Attendance / Dispatch stops / revision / follow-up guards", () => {
  it("Attendance and EmployeeDirectory coerce employees/depts before map/filter", () => {
    const attendance = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"),
      "utf8",
    );
    expect(attendance).toMatch(/employeesRaw/);
    expect(attendance).toMatch(/Array\.isArray\(employeesRaw\)/);
    expect(attendance).toMatch(/Array\.isArray\(deptsRaw\)/);
    const directory = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/EmployeeDirectory.tsx"),
      "utf8",
    );
    expect(directory).toMatch(/liveEmployeesRaw/);
    expect(directory).toMatch(/Array\.isArray\(liveEmployeesRaw\)/);
  });

  it("Dispatch LoadEditor uses stopsOf — never truthy string .length", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/function stopsOf\(stops: unknown\)/);
    expect(src).toMatch(/Array\.isArray\(stops\) && stops\.length/);
    expect(src).toMatch(/const editorStops = stopsOf\(form\.stops\)/);
    expect(src).not.toMatch(/load\?\.stops\?\.length \? structuredClone/);
  });

  it("suggestRevisionTargets / filterNotesByTag tolerate corrupt lists and tags", () => {
    expect(
      suggestRevisionTargets(
        null as unknown as [],
        { bad: true } as unknown as [],
        undefined as unknown as [],
      ),
    ).toEqual([]);
    expect(filterNotesByTag(null as unknown as [], "all")).toEqual([]);
    expect(
      filterNotesByTag(
        [{ id: "1", courseId: "c", title: "t", body: "", updatedAt: 1, tags: null as unknown as [] }],
        "revision",
      ),
    ).toEqual([]);
  });

  it("perf-followups persist merge and openFollowUps heal non-arrays", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/perf-followups.ts"), "utf8");
    expect(src).toMatch(/merge:\s*\(persisted, current\)/);
    expect(src).toMatch(/arr\(raw\.followUps/);
    usePerfFollowUps.setState({ followUps: "corrupt" as unknown as [], hrStatements: [] });
    expect(() => usePerfFollowUps.getState().openFollowUps()).not.toThrow();
    expect(usePerfFollowUps.getState().openFollowUps()).toEqual([]);
  });

  it("month-closing coerce months object and persist merge", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/month-closing.ts"), "utf8");
    expect(src).toMatch(/merge:\s*\(persisted, current\)/);
    expect(src).toMatch(/!Array\.isArray\(get\(\)\.months\)/);
    useMonthClosing.setState({ months: null as unknown as Record<string, never> });
    expect(useMonthClosing.getState().statusOf("2026-11")).toBe("open");
    expect(useMonthClosing.getState().closeMonth("2026-11", "HR")).toEqual({ ok: true });
    expect(useMonthClosing.getState().isClosed("2026-11")).toBe(true);
  });
});
