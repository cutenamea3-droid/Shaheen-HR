import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { componentPercents, estimateCgpa } from "@/personal/lib/gpa";

describe("Dispatch list coerce + GPA / mergeById guards", () => {
  it("DispatchApp coerces refresh loads/drivers and IssuesBoard list results", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/setLoads\(Array\.isArray\(nextLoads\)/);
    expect(src).toMatch(/healRosterDriver/);
    expect(src).toMatch(/healDispatchAccount/);
    expect(src).toMatch(/asFormText\(account\.display_name\)/);
    expect(src).toMatch(/asFormText\(d\.display_name\)/);
    expect(src).toMatch(/setIssues\(Array\.isArray\(iss\)/);
    expect(src).toMatch(/safeDrivers\.map/);
    expect(src).toMatch(/safeLoads\.map/);
  });

  it("mergeById coerces local/cloud before for-of", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/cloud-sync.ts"), "utf8");
    expect(src).toMatch(/const cloudList = Array\.isArray\(cloud\)/);
    expect(src).toMatch(/const localList = Array\.isArray\(local\)/);
  });

  it("estimateCgpa / componentPercents tolerate non-array inputs", () => {
    expect(estimateCgpa(null as unknown as [], undefined as unknown as []).cgpa).toBeNull();
    expect(componentPercents({ bad: true } as unknown as [])).toEqual([]);
  });

  it("estimateCgpa coerces non-string letter before trim", () => {
    expect(() =>
      estimateCgpa(
        [{ courseId: "c1", letter: null as unknown as string, creditHours: 3 } as never],
        [{ id: "c1", code: "CS", title: "CS", creditHours: 3 } as never],
      ),
    ).not.toThrow();
    const gpaSrc = readFileSync(resolve(process.cwd(), "src/personal/lib/gpa.ts"), "utf8");
    expect(gpaSrc).toMatch(/export function normalizeLetter\(raw: unknown\)/);
    expect(gpaSrc).toMatch(/normalizeLetter\(g\.letter\)/);
  });
});
