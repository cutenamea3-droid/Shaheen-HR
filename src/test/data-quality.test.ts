import { describe, expect, test } from "vitest";
import { SECTIONS, buildSeed, type Row } from "@/lib/sections";
import {
  DATA_QUALITY_POLICY,
  collectDataQualityFindings,
  dataQualityCounts,
  filterDataQualityFindings,
} from "@/lib/data-quality";

function row(partial: Partial<Row> & { cells: string[] }): Row {
  return {
    id: partial.id ?? "r1",
    driverId: partial.driverId ?? "d1",
    cells: partial.cells,
    ...(partial.rosterKind ? { rosterKind: partial.rosterKind } : {}),
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

function blankData() {
  const data = buildSeed();
  for (const id of Object.keys(data.sections)) data.sections[id].rows = [];
  return data;
}

describe("data quality review", () => {
  test("policy is review-only (no auto-merge)", () => {
    expect(DATA_QUALITY_POLICY.toLowerCase()).toContain("never auto-merge");
  });

  test("flags Valid without date and Applied with past expiry without changing status", () => {
    const data = blankData();
    data.sections.dmv.rows = [
      row({
        id: "dmv1",
        driverId: "d1",
        cells: ["Alpha Driver", "A123", "Applied", iso(-3), "", "", "Active", "", "CA", ""],
      }),
    ];
    data.sections.medical.rows = [
      row({
        id: "m1",
        driverId: "d1",
        cells: ["Alpha Driver", "Valid", "", "", "", "Active", "", ""],
      }),
    ];
    // Minimal other wizard rows so missing_section_row noise is controlled
    for (const id of ["queries", "ssccdl", "docs", "info"] as const) {
      const def = SECTIONS.find((s) => s.id === id)!;
      const activeIdx = def.types.indexOf("active");
      data.sections[id].rows = [
        row({
          id: `${id}1`,
          driverId: "d1",
          cells: data.sections[id].headers.map((_, i) =>
            i === 0 ? "Alpha Driver" : i === activeIdx ? "Active" : "",
          ),
        }),
      ];
    }

    const findings = collectDataQualityFindings(data);
    expect(findings.every((f) => f.reviewOnly === true)).toBe(true);
    expect(findings.some((f) => f.kind === "status_without_date")).toBe(true);
    expect(findings.some((f) => f.kind === "applied_past_expiry")).toBe(true);

    // Ensure we did not mutate Applied → Valid
    expect(data.sections.dmv.rows[0].cells[2]).toBe("Applied");
  });

  test("name mismatch and possible duplicates are reviewable; temp note text is not a finding", () => {
    const data = blankData();
    data.sections.dmv.rows = [
      row({
        id: "a",
        driverId: "d_a",
        cells: ["Same Name", "1", "Valid", iso(40), "", "", "Active", "", "CA", "temp note here"],
      }),
      row({
        id: "b",
        driverId: "d_b",
        cells: ["Same Name", "2", "Valid", iso(40), "", "", "Active", "", "CA", ""],
      }),
    ];
    data.sections.medical.rows = [
      row({
        id: "m",
        driverId: "d_a",
        cells: ["Same Name Typo", "Valid", iso(40), "", "", "Active", "", "ignore me temp"],
      }),
    ];

    const findings = collectDataQualityFindings(data);
    expect(findings.some((f) => f.kind === "name_mismatch")).toBe(true);
    expect(findings.some((f) => f.kind === "possible_duplicate_name")).toBe(true);
    expect(findings.every((f) => !/temp note/i.test(f.title))).toBe(true);

    const counts = dataQualityCounts(findings);
    expect(counts.all).toBe(findings.length);
    expect(filterDataQualityFindings(findings, { severity: "high" }).every((f) => f.severity === "high")).toBe(
      true,
    );
  });
});
