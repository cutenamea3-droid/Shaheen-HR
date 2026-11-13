import { describe, expect, test } from "vitest";
import { buildSeed, type Row } from "@/lib/sections";
import {
  INSPECTION_STATUS_LABEL,
  buildInspectionItems,
  buildInspectionSummaries,
  statusFromCell,
} from "@/lib/inspection-readiness";

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

describe("inspection readiness statuses", () => {
  test("vocabulary covers verified/present/missing/expired/pending/n_a/unable", () => {
    const keys = Object.keys(INSPECTION_STATUS_LABEL).sort();
    expect(keys).toEqual(
      ["expired", "missing", "n_a", "pending", "present", "unable", "verified"].sort(),
    );
  });

  test("Applied is pending (not verified); Valid+future is verified; past is expired", () => {
    expect(statusFromCell({ statusRaw: "Applied", expiryRaw: iso(10) }).status).toBe("pending");
    expect(statusFromCell({ statusRaw: "Valid", expiryRaw: iso(20) }).status).toBe("verified");
    expect(statusFromCell({ statusRaw: "Valid", expiryRaw: iso(-2) }).status).toBe("expired");
    expect(statusFromCell({ statusRaw: "Missing" }).status).toBe("missing");
    expect(statusFromCell({ statusRaw: "Valid", expiryRaw: "" }).status).toBe("unable");
    expect(statusFromCell({ statusRaw: "Valid", noExpiryRequired: true }).status).toBe("verified");
    expect(statusFromCell({ statusRaw: "WeirdCust", expiryRaw: iso(5) }).status).toBe("present");
  });

  test("driver checklist uses honest statuses; Future Plans / temp notes not in items", () => {
    const data = buildSeed();
    for (const id of Object.keys(data.sections)) data.sections[id].rows = [];

    data.sections.dmv.rows = [
      row({
        id: "dmv1",
        driverId: "d1",
        cells: ["Ready Driver", "C1", "Applied", iso(15), "", "", "Active", "I will Apply later", "CA", "Call Tuesday"],
      }),
    ];
    data.sections.medical.rows = [
      row({
        id: "m1",
        driverId: "d1",
        cells: ["Ready Driver", "Valid", iso(40), "", "", "Active", "plan text", ""],
      }),
    ];
    data.sections.queries.rows = [
      row({
        id: "q1",
        driverId: "d1",
        cells: ["Ready Driver", "Valid", iso(40), "Valid", iso(40), "", "", "", "Active", ""],
      }),
    ];
    data.sections.ssccdl.rows = [
      row({
        id: "s1",
        driverId: "d1",
        cells: ["Ready Driver", "C1", "Valid", iso(60), "Valid", "", "", "", "Active", ""],
      }),
    ];
    data.sections.docs.rows = [
      row({
        id: "doc1",
        driverId: "d1",
        cells: [
          "Ready Driver",
          "",
          ...Array.from({ length: 12 }, () => "Valid"),
          "",
          "Active",
          "temp",
        ],
      }),
    ];
    data.sections.info.rows = [
      row({ id: "i1", driverId: "d1", cells: ["Ready Driver", "555", "a@b.com", "CA"] }),
    ];

    const items = buildInspectionItems(data, "d1");
    expect(items.some((i) => i.document === "DMV Pull Notice" && i.status === "pending")).toBe(true);
    expect(items.some((i) => i.document === "Medical Certificate" && i.status === "verified")).toBe(true);
    expect(items.every((i) => !/future plan|temporary note|temp note/i.test(i.document))).toBe(true);
    expect(items.every((i) => !/Call Tuesday|I will Apply/i.test(i.evidence))).toBe(true);

    const summaries = buildInspectionSummaries(data);
    expect(summaries.some((s) => s.driverId === "d1")).toBe(true);
  });
});
