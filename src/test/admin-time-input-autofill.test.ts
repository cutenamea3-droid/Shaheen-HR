import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Admin TimeInput autofill", () => {
  it("commits parseable times on input without requiring blur", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/components/hr/common.tsx"), "utf8");
    expect(src).toMatch(/onInput=\{\(e\) => \{/);
    expect(src).toMatch(/parseTime\(t\)/);
    expect(src).toMatch(/onChange\(v\)/);
  });
});

describe("Admin add-employee / reminder / follow-up autofill", () => {
  it("reads DOM fallbacks for titles and employee name", () => {
    const team = readFileSync(resolve(process.cwd(), "src/admin/components/hr/Team.tsx"), "utf8");
    const rem = readFileSync(resolve(process.cwd(), "src/admin/components/hr/MyHrToday.tsx"), "utf8");
    const perf = readFileSync(resolve(process.cwd(), "src/admin/components/hr/Performance.tsx"), "utf8");
    expect(team).toMatch(/nameRef\.current\?\.value/);
    expect(team).toMatch(/data-testid="admin-add-employee-name"/);
    expect(rem).toMatch(/remTitleRef\.current\?\.value/);
    expect(perf).toMatch(/fuTitleRef\.current\?\.value/);
  });
});

describe("Dispatch roster autofill", () => {
  it("reads roster name/unit from DOM refs", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/DispatchApp.tsx"), "utf8");
    expect(src).toMatch(/data-testid="dispatch-roster-name"/);
    expect(src).toMatch(/nameRef\.current\?\.value/);
    expect(src).toMatch(/unitRef\.current\?\.value/);
  });
});
