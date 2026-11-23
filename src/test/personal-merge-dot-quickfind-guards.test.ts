import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDotAuditRows } from "@/lib/dot-audit";
import { buildFinderDrivers } from "@/lib/quick-find";
import { buildSeed, type AppData } from "@/lib/sections";

describe("Personal persist merge array coercion", () => {
  it("coerces courses/notes/assessments via Array.isArray", () => {
    const src = readFileSync(resolve(process.cwd(), "src/personal/lib/store.ts"), "utf8");
    expect(src).toMatch(/courses: arr\(raw\.courses, current\.courses\)/);
    expect(src).toMatch(/notes: arr\(raw\.notes, current\.notes\)/);
    expect(src).toMatch(/assessments: arr\(raw\.assessments, current\.assessments\)/);
  });
});

describe("dot-audit / quick-find tolerate null cells", () => {
  it("does not throw when a row has null cells", () => {
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
    expect(() => buildDotAuditRows(broken)).not.toThrow();
    expect(() => buildFinderDrivers(broken)).not.toThrow();
  });
});
