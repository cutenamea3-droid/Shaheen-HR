import { describe, expect, it } from "vitest";
import { collectPlans, collectHorizonDocs, collectSmartAlerts } from "@/lib/alerts";
import { buildSeed, type AppData } from "@/lib/sections";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("collectors tolerate missing cells", () => {
  it("collectPlans / horizon / smart alerts do not throw on null cells", () => {
    const base = buildSeed();
    const broken = {
      ...base,
      sections: {
        ...base.sections,
        dmv: {
          ...base.sections.dmv,
          rows: base.sections.dmv.rows.map((r, i) =>
            i === 0 ? { ...r, cells: null as unknown as string[] } : r,
          ),
        },
      },
    } as AppData;
    expect(() => collectPlans(broken)).not.toThrow();
    expect(() => collectHorizonDocs(broken)).not.toThrow();
    expect(() => collectSmartAlerts(broken)).not.toThrow();
  });
});

describe("Admin attendance persist merge array coercion", () => {
  it("merge coerces non-array employees/team/depts/logs", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/lib/store.ts"), "utf8");
    expect(src).toMatch(/employees: arr\(p\.employees, current\.employees\)/);
    expect(src).toMatch(/team: arr\(p\.team, current\.team\)/);
    expect(src).toMatch(/depts: arr\(p\.depts, current\.depts\)/);
    expect(src).toMatch(/logs: arr\(p\.logs, current\.logs\)/);
  });
});
