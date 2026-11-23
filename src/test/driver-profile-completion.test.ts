import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SECTIONS, buildSeed, type Row } from "@/lib/sections";
import { complianceScore } from "@/lib/alerts";
import { driverFileCompletenessPercent } from "@/lib/file-completeness";
import {
  DUPLICATE_DRIVER_POLICY,
  PROFILE_COMPLETION_FORMULA,
  PROFILE_SECTION_ORDER,
  buildDriverProfileCompletion,
  driverProfileCompletionPercent,
  findDuplicateDriverWarnings,
  otherDocsValidCount,
} from "@/lib/driver-profile-completion";

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

function blankData() {
  const data = buildSeed();
  for (const id of Object.keys(data.sections)) data.sections[id].rows = [];
  return data;
}

/** Other Docs 100% Valid + mixed other sections — reproduces ~53% card disconnect. */
function otherDocsPerfectPartialRest() {
  const data = blankData();
  const name = "Habibi Test";
  data.sections.dmv.rows = [
    row({
      id: "dmv1",
      driverId: "d1",
      cells: [name, "C", "Applied", iso(20), "", "", "Active", "", "CA", ""],
    }),
  ];
  data.sections.medical.rows = [
    row({
      id: "m1",
      driverId: "d1",
      cells: [name, "Missing", "", "", "", "Active", "", ""],
    }),
  ];
  data.sections.queries.rows = [
    row({
      id: "q1",
      driverId: "d1",
      cells: [name, "Missing", "", "Missing", "", "", "", "", "Active", ""],
    }),
  ];
  data.sections.ssccdl.rows = [
    row({
      id: "s1",
      driverId: "d1",
      cells: [name, "A1234567", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
    }),
  ];
  data.sections.docs.rows = [
    row({
      id: "doc1",
      driverId: "d1",
      cells: [name, "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""],
    }),
  ];
  data.sections.info.rows = [
    row({ id: "i1", driverId: "d1", cells: [name, "555-0100", "a@b.c", "CA"] }),
  ];
  return data;
}

describe("driver profile completion", () => {
  test("formula covers six sections and distinguishes Other Docs status vs profile", () => {
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/DMV/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/Medical/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/Clearinghouse/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/SSC & CDL/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/Other Docs/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/Driver Info/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/Valid÷12/);
    expect(PROFILE_COMPLETION_FORMULA).toMatch(/never auto-merged/i);
    expect(PROFILE_SECTION_ORDER.map((s) => s.id)).toEqual([
      "dmv",
      "medical",
      "queries",
      "ssccdl",
      "docs",
      "info",
    ]);
  });

  test("Other Docs 100% Valid is not the same as profile completion %", () => {
    const data = otherDocsPerfectPartialRest();
    const docsRow = data.sections.docs.rows[0];
    expect(complianceScore(docsRow)).toBe(100);
    expect(otherDocsValidCount(docsRow).valid).toBe(12);

    const c = buildDriverProfileCompletion(data, "d1");
    expect(c.otherDocsStatusPercent).toBe(100);
    expect(c.percent).toBeLessThan(100);
    expect(c.percent).toBe(driverProfileCompletionPercent(data, "d1"));
    // Card must not equal Other Docs status when other sections are incomplete.
    expect(c.percent).not.toBe(c.otherDocsStatusPercent);

    const docsSec = c.sections.find((s) => s.id === "docs")!;
    expect(docsSec.percent).toBe(100);
    const medical = c.sections.find((s) => s.id === "medical")!;
    expect(medical.complete).toBe(0);
    const dmv = c.sections.find((s) => s.id === "dmv")!;
    expect(dmv.items.some((i) => i.display === "pending" || !i.complete)).toBe(true);
  });

  test("Completion Details breakdown includes all six sections from saved records", () => {
    const data = otherDocsPerfectPartialRest();
    const c = buildDriverProfileCompletion(data, "d1");
    expect(c.sections).toHaveLength(6);
    for (const s of c.sections) {
      expect(s.rowPresent).toBe(true);
      expect(s.applicable).toBeGreaterThan(0);
    }
    const info = c.sections.find((s) => s.id === "info")!;
    expect(info.items.every((i) => i.concept === "presence")).toBe(true);
    expect(info.percent).toBe(100);
    const docs = c.sections.find((s) => s.id === "docs")!;
    expect(docs.items.every((i) => i.concept === "compliance")).toBe(true);
  });

  test("Driver Info empty / In-Valid lowers profile %; presence concept", () => {
    const data = otherDocsPerfectPartialRest();
    data.sections.info.rows = [
      row({ id: "i1", driverId: "d1", cells: ["Habibi Test", "", "In-Valid", ""] }),
    ];
    const c = buildDriverProfileCompletion(data, "d1");
    const info = c.sections.find((s) => s.id === "info")!;
    expect(info.complete).toBe(0);
    expect(info.applicable).toBe(3);
    expect(c.percent).toBeLessThan(
      buildDriverProfileCompletion(otherDocsPerfectPartialRest(), "d1").percent,
    );
  });

  test("Applied does not count complete; compliance aligns with file-completeness docs", () => {
    const data = otherDocsPerfectPartialRest();
    const c = buildDriverProfileCompletion(data, "d1");
    // Compliance excludes Driver Info — same checklist as File Completeness.
    expect(c.compliancePercent).toBe(driverFileCompletenessPercent(data, "d1"));
    const dmvItem = c.sections.find((s) => s.id === "dmv")!.items[0];
    expect(dmvItem.complete).toBe(false);
    expect(dmvItem.display).toBe("pending");
  });

  test("missing section row scores applicable gaps from actual saved data", () => {
    const data = blankData();
    data.sections.docs.rows = [
      row({
        id: "doc1",
        driverId: "solo",
        cells: ["Solo", "", ...Array.from({ length: 12 }, () => "Valid"), "", "Active", ""],
      }),
    ];
    const c = buildDriverProfileCompletion(data, "solo");
    expect(c.sections.find((s) => s.id === "docs")!.percent).toBe(100);
    expect(c.sections.find((s) => s.id === "dmv")!.rowPresent).toBe(false);
    expect(c.sections.find((s) => s.id === "info")!.complete).toBe(0);
    expect(c.percent).toBeLessThan(100);
  });

  test("duplicate drivers: warn by stable IDs, never auto-merge/delete", () => {
    expect(DUPLICATE_DRIVER_POLICY.toLowerCase()).toMatch(/never auto-merge/);
    const data = blankData();
    data.sections.dmv.rows = [
      row({
        id: "a",
        driverId: "id_a",
        cells: ["Same Person", "1", "Valid", iso(40), "", "", "Active", "", "CA", ""],
      }),
      row({
        id: "b",
        driverId: "id_b",
        cells: ["Same Person", "2", "Valid", iso(40), "", "", "Active", "", "CA", ""],
      }),
    ];
    data.sections.ssccdl.rows = [
      row({
        id: "sa",
        driverId: "id_a",
        cells: ["Same Person", "CDL999", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
      }),
      row({
        id: "sb",
        driverId: "id_b",
        cells: ["Same Person", "CDL999", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
      }),
    ];

    const warnings = findDuplicateDriverWarnings(data);
    expect(warnings.every((w) => w.reviewOnly === true)).toBe(true);
    const forA = warnings.find((w) => w.driverId === "id_a");
    expect(forA).toBeTruthy();
    expect(forA!.peerIds).toContain("id_b");
    expect(forA!.detail).toMatch(/id_b/);

    // Snapshot: no rows deleted / IDs unchanged.
    expect(data.sections.dmv.rows).toHaveLength(2);
    expect(data.sections.dmv.rows.map((r) => r.driverId).sort()).toEqual(["id_a", "id_b"]);
  });

  test("source guards: DriverCards uses profile completion, not raw Valid÷total", () => {
    const cards = readFileSync(resolve(process.cwd(), "src/components/tracker/DriverCards.tsx"), "utf8");
    expect(cards).toMatch(/buildDriverProfileCompletion/);
    expect(cards).toMatch(/CompletionDetails/);
    expect(cards).toMatch(/findDuplicateDriverWarnings/);
    expect(cards).not.toMatch(/d\.valid\s*\/\s*d\.total/);
    expect(cards).toMatch(/Other Docs status \(Valid÷12\) — not profile completion/);

    const lib = readFileSync(
      resolve(process.cwd(), "src/lib/driver-profile-completion.ts"),
      "utf8",
    );
    expect(lib).toMatch(/never auto-merged or deleted/i);
    expect(lib).not.toMatch(/linkDrivers\(/);
  });

  test("all wizard section ids are covered by profile order", () => {
    const wizard = SECTIONS.filter((s) => s.inWizard).map((s) => s.id);
    expect(PROFILE_SECTION_ORDER.map((s) => s.id).sort()).toEqual([...wizard].sort());
  });
});
