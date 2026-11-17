import { describe, expect, it } from "vitest";
import { analyzeRow, isOldExpiry, normStatus } from "@/lib/alerts";
import { filterWorkCenterItems } from "@/lib/alerts-work-center";
import { statusFromCell } from "@/lib/inspection-readiness";
import { SECTIONS } from "@/lib/sections";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("alerts / inspection scanners use cellsOf + coerce", () => {
  it("alerts.ts replaces raw cells casts with cellsOf", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/alerts.ts"), "utf8");
    expect(src).not.toMatch(/Array\.isArray\(row\.cells\) \? row\.cells : \[\]/);
    expect(src).not.toMatch(/Array\.isArray\(r\.cells\) \? r\.cells : \[\]/);
    expect(src).toMatch(/cellsOf\(row\)/);
  });

  it("analyzeRow tolerates non-string cell entries", () => {
    const def = SECTIONS.find((s) => s.id === "dmv")!;
    expect(() =>
      analyzeRow(def, ["Driver", "CDL", "Status"], {
        id: "r1",
        driverId: "d1",
        cells: ["Alex", 12345, "Valid"] as unknown as string[],
        addedAt: 1,
      }),
    ).not.toThrow();
  });

  it("analyzeRow stringifies non-string headers", () => {
    const def = SECTIONS.find((s) => s.id === "dmv")!;
    expect(() =>
      analyzeRow(def, [null, 2, "Status"] as unknown as string[], {
        id: "r1",
        driverId: "d1",
        cells: ["Alex", "CDL", "Valid"],
        addedAt: 1,
      }),
    ).not.toThrow();
  });

  it("normStatus / isOldExpiry / statusFromCell / work-center search coerce", () => {
    expect(normStatus(42 as unknown as string)).toBe("");
    expect(isOldExpiry(99 as unknown as string)).toBe(false);
    expect(() =>
      statusFromCell({
        statusRaw: 1 as unknown as string,
        expiryRaw: 20261117 as unknown as string,
      }),
    ).not.toThrow();
    expect(() =>
      filterWorkCenterItems(
        [
          {
            key: "k",
            kind: "issue",
            filters: ["all"],
            driverId: "d1",
            driver: "Alex",
            sectionId: "dmv",
            sectionTitle: "DMV",
            rowId: "r1",
            docType: "CDL",
            statusLabel: "ok",
            expiryRaw: "",
            expiryDisplay: "—",
            daysLeft: null,
            daysLabel: "",
            details: "",
            neededAction: "",
            worstTone: "ok",
          } as never,
        ],
        "all",
        1 as unknown as string,
      ),
    ).not.toThrow();
  });
});
