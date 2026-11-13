import { describe, expect, test } from "vitest";
import { buildSeed, type Row } from "@/lib/sections";
import {
  FILE_COMPLETENESS_FORMULA,
  buildFileCompletenessReport,
  driverFileCompletenessPercent,
  fileCompletenessCsv,
} from "@/lib/file-completeness";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  return {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
  };
}

function iso(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

describe("file completeness", () => {
  test("formula explains % and Applied does not count as complete", () => {
    expect(FILE_COMPLETENESS_FORMULA).toMatch(/Verified \+ Present/i);
    expect(FILE_COMPLETENESS_FORMULA).toMatch(/Temporary Notes/i);
    expect(FILE_COMPLETENESS_FORMULA).toMatch(/never auto-merge|Nothing is auto-merged/i);

    const data = buildSeed();
    for (const id of Object.keys(data.sections)) data.sections[id].rows = [];

    data.sections.dmv.rows = [
      row({
        id: "dmv1",
        driverId: "d1",
        cells: ["Pct Driver", "C", "Applied", iso(20), "", "", "Active", "", "CA", ""],
      }),
    ];
    data.sections.medical.rows = [
      row({
        id: "m1",
        driverId: "d1",
        cells: ["Pct Driver", "Valid", iso(40), "", "", "Active", "", ""],
      }),
    ];
    data.sections.queries.rows = [
      row({
        id: "q1",
        driverId: "d1",
        cells: ["Pct Driver", "Valid", iso(40), "Valid", iso(40), "", "", "", "Active", ""],
      }),
    ];
    data.sections.ssccdl.rows = [
      row({
        id: "s1",
        driverId: "d1",
        cells: ["Pct Driver", "C", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
      }),
    ];
    data.sections.docs.rows = [
      row({
        id: "doc1",
        driverId: "d1",
        cells: ["Pct Driver", "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""],
      }),
    ];
    data.sections.info.rows = [
      row({ id: "i1", driverId: "d1", cells: ["Pct Driver", "1", "a@b.c", "CA"] }),
    ];

    const report = buildFileCompletenessReport(data);
    expect(report.formula).toBe(FILE_COMPLETENESS_FORMULA);
    expect(report.drivers).toHaveLength(1);
    const d = report.drivers[0];
    expect(d.pending).toBeGreaterThanOrEqual(1);
    expect(d.percent).toBe(driverFileCompletenessPercent(data, "d1"));
    // Pending lowers completeness vs all-verified
    expect(d.percent).toBeLessThan(100);

    const csv = fileCompletenessCsv(report);
    expect(csv).toContain("Completeness %");
    expect(csv).toContain("Formula:");
    expect(csv).toContain("Pct Driver");
  });
});
