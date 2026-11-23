import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { linkDrivers, migrateData, syncInactiveRoster } from "@/lib/sections";
import { exportBackup, importBackup } from "@/lib/store";

describe("sections migrate/link tolerate missing rows", () => {
  it("source guards linkDrivers / syncInactive / SPLITS migrate", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/sections.ts"), "utf8");
    expect(src).toMatch(/if \(!sec \|\| !Array\.isArray\(sec\.rows\)\) continue;/);
    expect(src).toMatch(/if \(!Array\.isArray\(inaSec\.rows\)\) return/);
    expect(src).toMatch(
      /!Array\.isArray\(sec\.rows\) \|\| !Array\.isArray\(sec\.headers\) \|\| sec\.headers\.length !== sp\.oldLen/,
    );
  });

  it("migrateData does not throw when a section omits rows", () => {
    const envelope = JSON.parse(exportBackup()) as {
      data?: { sections: Record<string, Record<string, unknown>> };
      sections?: Record<string, Record<string, unknown>>;
    };
    const parsed = (envelope.data ?? envelope) as {
      sections: Record<string, Record<string, unknown>>;
    };
    const cdl = { ...parsed.sections.ssccdl };
    delete cdl.rows;
    parsed.sections.ssccdl = cdl;
    importBackup(JSON.stringify(parsed));
    const againEnv = JSON.parse(exportBackup()) as {
      data?: Parameters<typeof migrateData>[0];
    } & Parameters<typeof migrateData>[0];
    const again = (againEnv.data ?? againEnv) as Parameters<typeof migrateData>[0];
    expect(() => migrateData(again)).not.toThrow();
    expect(() => linkDrivers(again)).not.toThrow();
    expect(() => syncInactiveRoster(again)).not.toThrow();
  });
});
