import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { addRowForDriver, exportBackup, importBackup } from "@/lib/store";

describe("store mutations tolerate missing section.rows", () => {
  it("guards addRowForDriver / records / follow-ups against missing rows arrays", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/store.ts"), "utf8");
    expect(src).toMatch(/export function addRowForDriver[\s\S]*Array\.isArray\(sec\.rows\)/);
    expect(src).toMatch(/export function deleteRecord[\s\S]*!Array\.isArray\(sec\.rows\)/);
    expect(src).toMatch(/export function deleteFollowUp[\s\S]*!Array\.isArray\(sec\.rows\)/);
    expect(src).toMatch(/export function addRecord[\s\S]*Array\.isArray\(secRaw\.rows\)/);
    expect(src).toMatch(/export function addRecord[\s\S]*cellsOf\(\{ cells \}\)/);
    expect(src).toMatch(/normalizeRecordSection[\s\S]*Array\.isArray\(sec\.rows\)/);
    const fu = readFileSync(resolve(process.cwd(), "src/lib/follow-ups.ts"), "utf8");
    expect(fu).toMatch(/normalizeFollowUpSection[\s\S]*Array\.isArray\(sec\.rows\)/);
    const dt = readFileSync(resolve(process.cwd(), "src/components/tracker/DataTable.tsx"), "utf8");
    expect(dt).toMatch(/Array\.isArray\(def\.rules\)\s*\?\s*def\.rules\s*:\s*\[\]/);
  });

  it("addRowForDriver heals a corrupt CDL section without throwing", () => {
    const parsed = JSON.parse(exportBackup()) as {
      sections: Record<string, Record<string, unknown>>;
    };
    const cdl = { ...parsed.sections.cdl };
    delete cdl.rows;
    parsed.sections.cdl = cdl;
    importBackup(JSON.stringify(parsed));
    expect(() => addRowForDriver("cdl", "d_audit_rows", "Audit Driver")).not.toThrow();
    const after = JSON.parse(exportBackup()) as {
      sections: Record<string, { rows?: { driverId: string }[] }>;
    };
    expect(after.sections.cdl?.rows?.some((r) => r.driverId === "d_audit_rows")).toBe(true);
  });

  it("addRecord pads when cells is not an array", async () => {
    const { addRecord, exportBackup: exp } = await import("@/lib/store");
    expect(() => addRecord("extra_driver_documents", null as unknown as string[])).not.toThrow();
    const after = JSON.parse(exp()) as {
      sections: Record<string, { rows?: { cells?: string[] }[] }>;
    };
    const rows = after.sections.extra_driver_documents?.rows ?? [];
    const last = rows[rows.length - 1];
    expect(Array.isArray(last?.cells)).toBe(true);
    expect(last?.cells?.[5]).toBe("Active");
  });
});
