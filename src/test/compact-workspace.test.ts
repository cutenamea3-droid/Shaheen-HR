import { describe, expect, test } from "vitest";
import { analyzeRow, rowOrdinaryComplianceMuted } from "@/lib/alerts";
import { buildDriverDailyCounts } from "@/lib/daily-summary";
import { applyRosterKind, applyDriverClass, countTempNotes, isNewDriver, isOwnerOperator } from "@/lib/driver-meta";
import { buildSeed, SECTIONS } from "@/lib/sections";

describe("compact workspace — daily summary (calc reuse)", () => {
  test("temp notes counted separately and never as expired/soon/applied issues", () => {
    let data = buildSeed();
    const def = SECTIONS.find((s) => s.id === "dmv")!;
    const row = data.sections.dmv.rows[0];
    expect(row).toBeTruthy();
    const idx = def.types.indexOf("tempnote");
    expect(idx).toBeGreaterThanOrEqual(0);
    const cells = [...row!.cells];
    cells[idx] = "Call about CDL appointment";
    data = {
      ...data,
      sections: {
        ...data.sections,
        dmv: {
          ...data.sections.dmv,
          rows: data.sections.dmv.rows.map((r) => (r.id === row!.id ? { ...r, cells } : r)),
        },
      },
    };
    expect(countTempNotes(data, row!.driverId)).toBeGreaterThan(0);
    const { issues } = analyzeRow(def, data.sections.dmv.headers, data.sections.dmv.rows.find((r) => r.id === row!.id)!);
    expect(issues.every((i) => i.tone !== "note" || !/temporary/i.test(i.label))).toBe(true);
    // tempnote column never produces an issue
    expect(issues.every((i) => i.col !== idx)).toBe(true);

    const counts = buildDriverDailyCounts(data);
    expect(counts.tempNotes).toBeGreaterThanOrEqual(1);
  });

  test("New and OO stay separate from ordinary expired/soon/applied tallies", () => {
    let data = buildSeed();
    const id = data.sections.dmv.rows[0]!.driverId;
    data = applyRosterKind(data, id, "new");
    expect(isNewDriver(data, id)).toBe(true);
    const mutedNew = SECTIONS.filter((s) => s.id !== "inactive").every((def) => {
      const r = data.sections[def.id].rows.find((x) => x.driverId === id);
      return !r || rowOrdinaryComplianceMuted(def, r, data);
    });
    expect(mutedNew).toBe(true);

    data = applyRosterKind(data, id, "roster");
    data = applyDriverClass(data, id, "owner_operator");
    expect(isOwnerOperator(data, id)).toBe(true);
    const mutedOo = SECTIONS.filter((s) => s.id !== "inactive").every((def) => {
      const r = data.sections[def.id].rows.find((x) => x.driverId === id);
      return !r || rowOrdinaryComplianceMuted(def, r, data);
    });
    expect(mutedOo).toBe(true);

    const counts = buildDriverDailyCounts(data);
    expect(counts.oo).toBeGreaterThanOrEqual(1);
    expect(counts.new).toBe(0);
  });

  test("daily summary returns all keys", () => {
    const counts = buildDriverDailyCounts(buildSeed());
    for (const k of ["expired", "soon", "applied", "tempNotes", "new", "oo"] as const) {
      expect(typeof counts[k]).toBe("number");
      expect(counts[k]).toBeGreaterThanOrEqual(0);
    }
  });
});
