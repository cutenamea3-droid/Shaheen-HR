import { buildSeed, migrateData, normalizeSections, type AppData } from "@/lib/sections";
import { analyzeRow, isOldExpiry, suggestApplyPlan } from "@/lib/alerts";
import { SECTIONS } from "@/lib/sections";
import { test, expect } from "vitest";

test("split + queries dual plans + temporary notes", () => {
  const d = buildSeed();
  const q = d.sections.queries, s = d.sections.ssccdl;
  expect(q.headers.slice(5)).toEqual([
    "Notes",
    "Annual Query Future Plan",
    "Pre-Employment Future Plan",
    "Status",
    "Temporary Note",
  ]);
  expect(s.headers.slice(6)).toEqual(["Notes", "Future Plans", "Status", "Temporary Note"]);
  const k = q.rows.find((r) => r.cells[0] === "Khalid Mahmood")!;
  expect(k.cells[6]).toContain("November 21");
  expect(k.cells[7]).toBe(""); // Pre-Employment plan migrated empty
  expect(k.cells[8]).toBe("Inactive");
  expect(k.cells[9]).toBe(""); // Temporary Note
  const g = s.rows.find((r) => r.cells[0] === "Gurpreet Singh")!;
  expect(g.cells[7]).toMatch(/December\s*01/i);
  expect(g.cells[8]).toBe("Active");
  expect(g.cells[9]).toBe("");
  for (const id of ["dmv", "medical", "queries", "ssccdl", "docs"] as const) {
    expect(d.sections[id].headers.some((h) => /temporary note/i.test(h))).toBe(true);
    expect(SECTIONS.find((x) => x.id === id)!.types.includes("tempnote")).toBe(true);
  }
});

test("suggestApplyPlan is expiry minus 14 days", () => {
  // 2027-05-07 − 14d = 2027-04-23 (Friday)
  expect(suggestApplyPlan("2027-05-07")).toBe("I will Apply on April 23 (Friday), 2027");
  expect(suggestApplyPlan(" Old")).toBeNull();
  expect(suggestApplyPlan("")).toBeNull();
  expect(isOldExpiry(" Old")).toBe(true);
  expect(isOldExpiry("OLD")).toBe(true);
  expect(isOldExpiry("2027-05-07")).toBe(false);
});

test("old expiry skips amber/red; annual & pre-emp independent", () => {
  const def = SECTIONS.find((s) => s.id === "queries")!;
  const headers = [
    "Driver Name",
    "Annual",
    "Ann Exp",
    "Pre",
    "Pre Exp",
    "Notes",
    "Annual Query Future Plan",
    "Pre-Employment Future Plan",
    "Status",
    "Temporary Note",
  ];
  const row = {
    id: "t1",
    driverId: "d_t",
    cells: [
      "Test Driver",
      "Valid",
      "2099-01-01", // annual far away — no date issue
      "Valid",
      " Old", // pre-emp old — no amber/red
      "regular note",
      "",
      "",
      "Active",
      "temp only — must not yellow",
    ],
  };
  const { issues, cellTone } = analyzeRow(def, headers, row);
  expect(issues.some((i) => i.col === 2 || i.col === 4)).toBe(false);
  expect(issues.some((i) => i.col === 6 || i.col === 7)).toBe(false);
  expect(cellTone[5]).toBe("note"); // Notes yellow
  expect(cellTone[9]).toBeUndefined(); // Temporary Note never highlights
  expect(issues.some((i) => i.col === 9)).toBe(false);

  // Independent: only annual near expiry → only annual plan highlighted
  const near = {
    ...row,
    cells: [
      "Test Driver",
      "Valid",
      new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      "Valid",
      " Old",
      "",
      "",
      "",
      "Active",
      "",
    ],
  };
  const a = analyzeRow(def, headers, near);
  expect(a.issues.some((i) => i.col === 2)).toBe(true);
  expect(a.issues.some((i) => i.col === 6)).toBe(true);
  expect(a.issues.some((i) => i.col === 4 || i.col === 7)).toBe(false);
});

test("normalizeSections appends without shifting existing values", () => {
  const base: AppData = {
    version: 1,
    sections: {
      queries: {
        headers: [
          "Driver Name",
          "Clearing House Annual Query ",
          " | Exp Date",
          "Pre Employment Query ",
          " Exp",
          "Notes",
          "Future Plans",
          "Status",
        ],
        widths: [230, 190, 190, 190, 190, 340, 340, 150],
        hidden: Array(8).fill(false),
        rows: [
          {
            id: "q0",
            driverId: "d1",
            cells: ["A", "Valid", "2027-05-07", "Valid", " Old", "keep-me", "plan-text", "Active"],
          },
        ],
      },
      dmv: {
        headers: ["Driver Name", "DL", "Status", "Exp", "Report", "Notes", "Status", "Future Plans", "State"],
        widths: Array(9).fill(200),
        hidden: Array(9).fill(false),
        rows: [{ id: "d0", driverId: "d1", cells: ["A", "1", "Valid", "2027-01-01", "NONE", "n", "Active", "p", "CA"] }],
      },
    },
  };
  // Ensure other SECTIONS keys exist empty so migrate/normalize don't blow up via linkDrivers
  for (const def of SECTIONS) {
    if (!base.sections[def.id]) {
      base.sections[def.id] = { headers: ["Driver Name"], widths: [230], hidden: [false], rows: [] };
    }
  }
  const { data } = migrateData(base);
  const q = data.sections.queries;
  expect(q.rows[0].cells[5]).toBe("keep-me");
  expect(q.rows[0].cells[6]).toBe("plan-text"); // Annual keeps old plan
  expect(q.rows[0].cells[7]).toBe(""); // Pre-Employment empty
  expect(q.rows[0].cells[8]).toBe("Active");
  expect(q.headers[9]).toMatch(/temporary note/i);
  expect(q.rows[0].cells[9]).toBe("");
  expect(data.sections.dmv.headers.at(-1)).toMatch(/temporary note/i);
  expect(data.sections.dmv.rows[0].cells.slice(0, 9)).toEqual([
    "A", "1", "Valid", "2027-01-01", "NONE", "n", "Active", "p", "CA",
  ]);
  // Idempotent
  const again = normalizeSections(data);
  expect(again.changed).toEqual([]);
});
